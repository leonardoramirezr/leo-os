// What the editor does to a table. Every function hands back a new table and leaves the one it was
// given alone, so that undo can keep the one before as it was.
//
// Rows are counted with the header as 0, the way `cells` holds them: the body starts at 1.
import { numberOf, type Align, type TableData } from './markdown';

const ALIGNS: readonly Align[] = ['', 'left', 'center', 'right'];

/** A table nobody has typed in yet: an empty header and `rows` empty rows under it. */
export function blank(columns: number, rows: number): TableData {
	return {
		cells: Array.from({ length: rows + 1 }, () => Array<string>(columns).fill('')),
		align: Array<Align>(columns).fill('')
	};
}

/**
 * A table as the database or an earlier version of the app may have kept it, checked: anything
 * that does not add up is dropped, and rows of different lengths are evened out.
 */
export function tableOf(cells: unknown, align: unknown): TableData | undefined {
	if (!Array.isArray(cells) || !cells.length) return undefined;

	const rows = cells.map((row) =>
		Array.isArray(row) ? row.map((cell) => (typeof cell === 'string' ? cell : '')) : []
	);
	const aligns = (Array.isArray(align) ? align : []).map((value) =>
		ALIGNS.includes(value as Align) ? (value as Align) : ''
	);
	const columns = Math.max(1, aligns.length, ...rows.map((row) => row.length));
	return {
		cells: rows.map((row) => [...row, ...Array<string>(columns - row.length).fill('')]),
		align: [...aligns, ...Array<Align>(columns - aligns.length).fill('')].slice(0, columns)
	};
}

export function setCell(table: TableData, row: number, column: number, value: string): TableData {
	return { ...table, cells: table.cells.with(row, table.cells[row].with(column, value)) };
}

/** An empty row at `at`, which is where it ends up: 1 is right under the header. */
export function insertRow(table: TableData, at: number): TableData {
	const cells = table.cells.toSpliced(at, 0, Array<string>(table.align.length).fill(''));
	return { ...table, cells };
}

export function duplicateRow(table: TableData, row: number): TableData {
	return { ...table, cells: table.cells.toSpliced(row + 1, 0, [...table.cells[row]]) };
}

/** Never the header: a Markdown table always has one. */
export function removeRow(table: TableData, row: number): TableData {
	return row < 1 ? table : { ...table, cells: table.cells.toSpliced(row, 1) };
}

/** Swaps a row of the body with the one before (-1) or after (+1). Never with the header. */
export function moveRow(table: TableData, row: number, by: -1 | 1): TableData {
	const other = row + by;
	if (row < 1 || other < 1 || other >= table.cells.length) return table;
	return { ...table, cells: table.cells.with(row, table.cells[other]).with(other, table.cells[row]) };
}

/** A row of the body becomes the header, and the header the first row under it: data pasted without one. */
export function promoteRow(table: TableData, row: number): TableData {
	if (row < 1) return table;
	const [header, ...body] = table.cells;
	const rest = body.toSpliced(row - 1, 1);
	return { ...table, cells: [table.cells[row], header, ...rest] };
}

/** An empty column at `at`, which is where it ends up: 0 is the first. */
export function insertColumn(table: TableData, at: number): TableData {
	return {
		cells: table.cells.map((row) => row.toSpliced(at, 0, '')),
		align: table.align.toSpliced(at, 0, '')
	};
}

export function duplicateColumn(table: TableData, column: number): TableData {
	return {
		cells: table.cells.map((row) => row.toSpliced(column + 1, 0, row[column])),
		align: table.align.toSpliced(column + 1, 0, table.align[column])
	};
}

/** Never the last one: a table has at least one column. */
export function removeColumn(table: TableData, column: number): TableData {
	if (table.align.length <= 1) return table;
	return {
		cells: table.cells.map((row) => row.toSpliced(column, 1)),
		align: table.align.toSpliced(column, 1)
	};
}

/** Swaps a column with the one before (-1) or after (+1). */
export function moveColumn(table: TableData, column: number, by: -1 | 1): TableData {
	const other = column + by;
	if (other < 0 || other >= table.align.length) return table;
	const swap = <T>(list: T[]) => list.with(column, list[other]).with(other, list[column]);
	return { cells: table.cells.map(swap), align: swap(table.align) };
}

export function setAlign(table: TableData, column: number, align: Align): TableData {
	return { ...table, align: table.align.with(column, align) };
}

/** Alphabetical the way a person reads it: «b» next to «B», «Fila 2» before «Fila 10». */
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/**
 * The body sorted by a column, up (1) or down (-1): numbers as numbers when both are, text
 * alphabetically, and empty cells last either way. Rows that tie keep their order.
 */
export function sortBy(table: TableData, column: number, direction: 1 | -1): TableData {
	const [header, ...body] = table.cells;
	const sorted = body.toSorted((a, b) => {
		const x = a[column].trim();
		const y = b[column].trim();
		if (!x || !y) return x ? -1 : y ? 1 : 0;

		const first = numberOf(x);
		const second = numberOf(y);
		const order = first !== undefined && second !== undefined ? first - second : collator.compare(x, y);
		return order * direction;
	});
	return { ...table, cells: [header, ...sorted] };
}

/** Whether nothing has been typed in it, header included: a table to fill in, not one to look at. */
export function isEmpty(table: TableData): boolean {
	return table.cells.every((row) => row.every((cell) => !cell.trim()));
}
