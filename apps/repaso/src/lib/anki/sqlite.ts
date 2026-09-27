// Reads SQLite database files: enough to walk every row of a table, which is all an Anki collection
// asks for. Only ordinary tables are read, straight from the bytes, with nothing written.
//
// The file comes from whoever shared the deck, so it is read with suspicion: a page number out of
// range or a page visited twice ends the read with an error, rather than with a tab that hangs.
//
// The format: https://www.sqlite.org/fileformat2.html

/** What a column holds: SQLite's integers and reals are both numbers here. */
export type Value = null | number | string | Uint8Array;

export class SqliteError extends Error {
	constructor(message = 'Not an SQLite database') {
		super(message);
		this.name = 'SqliteError';
	}
}

interface Table {
	root: number;
	columns: string[];
	/** The column that is the rowid under another name (`id integer primary key`), or -1. */
	rowid: number;
}

const MAGIC = 'SQLite format 3\u0000';
const LEAF_TABLE = 13;
const INTERIOR_TABLE = 5;

/** What starts a table constraint rather than a column in `create table`. */
const CONSTRAINT = /^(constraint|primary|unique|check|foreign)\b/i;

/** The names of a table's columns, in order, from the `create table` statement it was made with. */
function parseColumns(statement: string): Omit<Table, 'root'> {
	// Anki numbers its columns in comments: `id integer primary key, /* 0 */`.
	const sql = statement.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
	const body = sql.slice(sql.indexOf('(') + 1, sql.lastIndexOf(')'));

	// Split at the commas outside parentheses and quotes: `check (a in (1, 2))` is one definition.
	const definitions: string[] = [];
	let depth = 0;
	let quote = '';
	let start = 0;
	for (let i = 0; i < body.length; i++) {
		const char = body[i];
		if (quote) {
			if (char === quote) quote = '';
		} else if (char === '"' || char === "'" || char === '`') quote = char;
		else if (char === '[') quote = ']';
		else if (char === '(') depth++;
		else if (char === ')') depth--;
		else if (char === ',' && depth === 0) {
			definitions.push(body.slice(start, i));
			start = i + 1;
		}
	}
	definitions.push(body.slice(start));

	const columns: string[] = [];
	let rowid = -1;
	for (const definition of definitions.map((text) => text.trim())) {
		if (!definition || CONSTRAINT.test(definition)) continue;
		const quoted = /^(?:"([^"]*)"|\[([^\]]*)\]|`([^`]*)`|'([^']*)')/.exec(definition);
		const name = quoted ? quoted.slice(1).find((part) => part !== undefined)! : definition.split(/\s/)[0];
		if (/^\S+\s+integer\s+primary\s+key\b/i.test(definition)) rowid = columns.length;
		columns.push(name);
	}
	return { columns, rowid };
}

export class Database {
	#bytes: Uint8Array;
	#view: DataView;
	#pageSize: number;
	/** Each page minus the bytes an extension may keep at its end. */
	#usable: number;
	#pages: number;
	#decoder: TextDecoder;
	#tables = new Map<string, Table>();

	constructor(bytes: Uint8Array) {
		this.#bytes = bytes;
		this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		if (bytes.byteLength < 100 || new TextDecoder().decode(bytes.subarray(0, 16)) !== MAGIC) {
			throw new SqliteError();
		}

		const size = this.#view.getUint16(16);
		this.#pageSize = size === 1 ? 65536 : size;
		this.#usable = this.#pageSize - bytes[20];
		this.#pages = Math.floor(bytes.byteLength / this.#pageSize);
		if (this.#pageSize < 512 || this.#usable < 480 || !this.#pages) throw new SqliteError();

		const encoding = this.#view.getUint32(56);
		this.#decoder = new TextDecoder(encoding === 2 ? 'utf-16le' : encoding === 3 ? 'utf-16be' : 'utf-8');

		// The schema is itself a table, rooted at the first page: type, name, tbl_name, rootpage, sql.
		for (const [, type, name, , root, sql] of this.#walk(1)) {
			if (type !== 'table' || typeof name !== 'string' || typeof root !== 'number') continue;
			// Without a rowid a table is stored as an index, which nothing here needs to read.
			if (typeof sql !== 'string' || /\bwithout\s+rowid\b/i.test(sql)) continue;
			this.#tables.set(name.toLowerCase(), { root, ...parseColumns(sql) });
		}
	}

	has(table: string): boolean {
		return this.#tables.has(table.toLowerCase());
	}

	/** Every row of the table, in rowid order, each keyed by its column names. */
	*rows(table: string): Generator<Record<string, Value>> {
		const found = this.#tables.get(table.toLowerCase());
		if (!found) throw new SqliteError(`No table ${table}`);

		for (const [rowid, ...values] of this.#walk(found.root)) {
			const row: Record<string, Value> = {};
			found.columns.forEach((column, index) => {
				// A column added after the row was written reads as null; the rowid alias is stored as null.
				row[column] = index === found.rowid ? rowid : (values[index] ?? null);
			});
			yield row;
		}
	}

	/** The rows under a table's root page, each as its rowid followed by its values. */
	*#walk(root: number): Generator<Value[]> {
		const seen = new Set<number>();
		const pending = [root];

		while (pending.length) {
			const page = pending.pop()!;
			if (page < 1 || page > this.#pages || seen.has(page)) throw new SqliteError('Corrupt page');
			seen.add(page);

			const start = (page - 1) * this.#pageSize;
			// The first page starts with the file's header.
			const header = start + (page === 1 ? 100 : 0);
			const type = this.#bytes[header];
			const cells = this.#view.getUint16(header + 3);

			if (type === INTERIOR_TABLE) {
				// Children are visited in key order: a stack, so the last one pushed comes out first.
				pending.push(this.#view.getUint32(header + 8));
				for (let cell = cells - 1; cell >= 0; cell--) {
					const at = start + this.#view.getUint16(header + 12 + cell * 2);
					pending.push(this.#u32(at));
				}
			} else if (type === LEAF_TABLE) {
				for (let cell = 0; cell < cells; cell++) {
					let at = start + this.#view.getUint16(header + 8 + cell * 2);
					const [size, sizeLength] = this.#varint(at);
					at += sizeLength;
					const [rowid, rowidLength] = this.#varint(at);
					at += rowidLength;
					yield [rowid, ...this.#record(this.#payload(at, size))];
				}
			} else {
				throw new SqliteError('Corrupt page');
			}
		}
	}

	/** A cell's payload, gathered from the overflow pages it spills into when it does not fit. */
	#payload(at: number, size: number): Uint8Array {
		const usable = this.#usable;
		const most = usable - 35;
		if (size <= most) return this.#slice(at, at + size);
		// No row is larger than the file it is in: a size past that is damage, not a row to make room for.
		if (size > this.#bytes.byteLength) throw new SqliteError('Corrupt payload');

		const least = Math.floor(((usable - 12) * 32) / 255) - 23;
		const fits = least + ((size - least) % (usable - 4));
		const local = fits <= most ? fits : least;

		const payload = new Uint8Array(size);
		payload.set(this.#slice(at, at + local));
		let filled = local;
		let next = this.#u32(at + local);
		const seen = new Set<number>();
		while (filled < size) {
			if (next < 1 || next > this.#pages || seen.has(next)) throw new SqliteError('Corrupt overflow');
			seen.add(next);
			const start = (next - 1) * this.#pageSize;
			const length = Math.min(usable - 4, size - filled);
			payload.set(this.#slice(start + 4, start + 4 + length), filled);
			filled += length;
			next = this.#u32(start);
		}
		return payload;
	}

	/** A record: a header of serial types, then the values they describe. */
	#record(payload: Uint8Array): Value[] {
		const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
		const read = (at: number) => this.#varint(at, payload);

		const [headerSize, headerLength] = read(0);
		const types: number[] = [];
		for (let at = headerLength; at < headerSize; ) {
			const [type, length] = read(at);
			types.push(type);
			at += length;
		}

		const values: Value[] = [];
		let at = headerSize;
		for (const type of types) {
			if (type === 0) values.push(null);
			else if (type === 8 || type === 9) values.push(type - 8);
			else if (type >= 12) {
				const length = Math.floor((type - 12) / 2);
				if (at + length > payload.byteLength) throw new SqliteError('Corrupt record');
				const data = payload.subarray(at, at + length);
				values.push(type % 2 ? this.#decoder.decode(data) : data.slice());
				at += length;
			} else {
				const width = [0, 1, 2, 3, 4, 6, 8, 8][type];
				if (!width || at + width > payload.byteLength) throw new SqliteError('Corrupt record');
				values.push(type === 7 ? view.getFloat64(at) : integer(view, at, width));
				at += width;
			}
		}
		return values;
	}

	/**
	 * A variable-length integer and how many bytes it took. Anki's rowids are timestamps in
	 * milliseconds, well within what a number holds exactly; negative ones are not expected.
	 */
	#varint(at: number, bytes = this.#bytes): [number, number] {
		let value = 0;
		for (let i = 0; i < 9; i++) {
			if (at + i >= bytes.byteLength) throw new SqliteError('Corrupt varint');
			const byte = bytes[at + i];
			if (i === 8) return [value * 256 + byte, 9];
			value = value * 128 + (byte & 0x7f);
			if (byte < 0x80) return [value, i + 1];
		}
		throw new SqliteError('Corrupt varint');
	}

	#u32(at: number): number {
		if (at + 4 > this.#bytes.byteLength) throw new SqliteError('Corrupt page');
		return this.#view.getUint32(at);
	}

	#slice(start: number, end: number): Uint8Array {
		if (end > this.#bytes.byteLength) throw new SqliteError('Corrupt page');
		return this.#bytes.subarray(start, end);
	}
}

/** A big-endian two's complement integer of 1 to 8 bytes. */
function integer(view: DataView, at: number, width: number): number {
	if (width === 8) return Number(view.getBigInt64(at));
	let value = view.getInt8(at);
	for (let i = 1; i < width; i++) value = value * 256 + view.getUint8(at + i);
	return value;
}
