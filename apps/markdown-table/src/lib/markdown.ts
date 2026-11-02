// Tables as text, both ways: what is pasted turns into rows and columns, and a table turns back into
// Markdown to copy, its columns padded so that it still reads as a table wherever it is pasted.
//
// The flavour is GitHub's (GFM), the one nearly every editor, chat and README speaks: a header row,
// a delimiter row that says how each column lines up (`:--`, `:-:`, `--:`), then the rows. The pipes
// at either end of a row are optional, and a `|` inside a cell is written `\|`. A cell holds
// Markdown of its own — `**bold**`, `` `code` ``, `<br>` for a new line — which is kept as typed.
//
// What a spreadsheet copies is read too: tab-separated cells, the way Numbers, Excel and Google
// Sheets put them on the clipboard, and CSV.
import type { MarkdownTableAlign } from '@leo-os/shared';

export type Align = MarkdownTableAlign;

export interface TableData {
	/** The header first, then every row; every row as long as `align`. A cell's Markdown, `|` unescaped. */
	cells: string[][];
	/** One per column. */
	align: Align[];
}

/** A line with a pipe that is not escaped: the least a row of a Markdown table has. */
const PIPE = /(^|[^\\])\|/;

/** Splits a row into its cells, unescaping `\|`. */
function splitRow(line: string): string[] {
	let row = line.trim();
	if (row.startsWith('|')) row = row.slice(1);
	if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);

	const cells: string[] = [];
	let cell = '';
	for (let i = 0; i < row.length; i++) {
		if (row[i] === '\\' && row[i + 1] === '|') {
			cell += '|';
			i++;
		} else if (row[i] === '|') {
			cells.push(cell.trim());
			cell = '';
		} else cell += row[i];
	}
	cells.push(cell.trim());
	return cells;
}

/** The alignments a delimiter row (`| :-- | :-: |`) says, or `undefined` when the line is not one. */
function delimiter(line: string): Align[] | undefined {
	if (!line.includes('-')) return undefined;

	const aligns: Align[] = [];
	for (const cell of splitRow(line)) {
		const rule = cell.replace(/\s+/g, '');
		if (!/^:?-+:?$/.test(rule)) return undefined;
		const left = rule.startsWith(':');
		const right = rule.endsWith(':');
		aligns.push(left && right ? 'center' : right ? 'right' : left ? 'left' : '');
	}
	return aligns;
}

/** Every row as long as the longest, and one alignment per column. Nothing pasted is dropped. */
function rectangle(rows: string[][], align: Align[] = []): TableData {
	const columns = Math.max(1, align.length, ...rows.map((row) => row.length));
	const pad = <T>(list: T[], fill: T) => [...list, ...Array<T>(columns - list.length).fill(fill)];
	return { cells: rows.map((row) => pad(row, '')), align: pad(align.slice(0, columns), '') };
}

/** The first Markdown table in the text, delimiter row and all; `undefined` when there is none. */
export function parseMarkdown(text: string): TableData | undefined {
	const lines = text.replace(/\r\n?/g, '\n').split('\n');

	for (let i = 0; i + 1 < lines.length; i++) {
		const header = lines[i];
		const rule = lines[i + 1];
		// Without a pipe in either line, `---` under a line of text is a heading, not a table.
		if (!header.trim() || !(PIPE.test(header) || PIPE.test(rule))) continue;

		const align = delimiter(rule);
		if (!align) continue;

		const rows = [splitRow(header)];
		for (let j = i + 2; j < lines.length; j++) {
			// A blank line, or one with no pipe, is where the table ends.
			if (!lines[j].trim() || !PIPE.test(lines[j])) break;
			rows.push(splitRow(lines[j]));
		}
		return rectangle(rows, align);
	}
	return undefined;
}

/**
 * Cells separated by `separator`, a row per line, with quotes around a cell that holds the
 * separator, a quote (doubled) or a line break — which becomes `<br>`, Markdown's own.
 */
function splitDelimited(text: string, separator: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (quoted) {
			if (char === '"' && text[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (char === '"') quoted = false;
			else cell += char === '\n' ? '<br>' : char;
		} else if (char === '"' && cell === '') quoted = true;
		else if (char === separator) {
			row.push(cell.trim());
			cell = '';
		} else if (char === '\n') {
			row.push(cell.trim());
			rows.push(row);
			row = [];
			cell = '';
		} else cell += char;
	}
	row.push(cell.trim());
	rows.push(row);

	// Blank lines, and the one a copied range ends with, are not rows.
	return rows.filter((cells) => cells.some((value) => value !== ''));
}

/** A number as it may be written in a cell: `1,234.5`, `1.234,5`, `$20`, `-3 %`… */
export function numberOf(text: string): number | undefined {
	const bare = text
		.trim()
		.replace(/^([-+]?)[$€£¥]\s?/, '$1')
		.replace(/\s?[$€£¥%]$/, '')
		.replace(/[\s ]/g, '');
	if (!/^[-+]?\d[\d.,]*$/.test(bare) || /[.,]$/.test(bare)) return undefined;

	const dot = bare.lastIndexOf('.');
	const comma = bare.lastIndexOf(',');
	let decimal = dot > comma ? '.' : ',';
	if (dot === -1 || comma === -1) {
		// One kind of separator only. Twice or more, or a single one with three digits after it and
		// something other than a lone 0 before, is a thousands one: 1.000.000, 1,500.
		const separator = dot === -1 ? ',' : '.';
		const parts = bare.split(separator);
		const thousands =
			parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && !/^[-+]?0$/.test(parts[0]));
		decimal = thousands ? '' : separator;
	}

	const plain = [...bare].filter((char) => !'.,'.includes(char) || char === decimal).join('');
	const value = Number(plain.replace(',', '.'));
	return Number.isFinite(value) ? value : undefined;
}

/** A spreadsheet's numbers line up on the right, as it showed them. */
function alignNumbers(table: TableData): TableData {
	const align = table.align.map((current, column): Align => {
		const values = table.cells.slice(1).map((row) => row[column]).filter((cell) => cell !== '');
		return values.length && values.every((cell) => numberOf(cell) !== undefined) ? 'right' : current;
	});
	return { ...table, align };
}

/** Cells separated by commas or semicolons, as many in every row: anything less is prose. */
function csv(text: string): TableData | undefined {
	for (const separator of [',', ';']) {
		if (!text.includes(separator)) continue;
		const rows = splitDelimited(text, separator);
		const columns = rows[0]?.length ?? 0;
		if (rows.length >= 2 && columns >= 2 && rows.every((row) => row.length === columns)) {
			return alignNumbers(rectangle(rows));
		}
	}
	return undefined;
}

/** A line of dashes between rows, `|---|---|` or `+----+----+`, as ASCII tables draw them. */
function isRule(line: string): boolean {
	return /^[|+][\s|:+=-]*$/.test(line) && /[-=]/.test(line);
}

/**
 * Rows written with pipes and no delimiter row right under the first one: a Markdown table missing
 * it, or an ASCII table like the ones a database console prints, rules and all.
 */
function pipeRows(lines: string[]): TableData | undefined {
	const rows: string[][] = [];
	for (const raw of lines) {
		const line = raw.trim();
		if (isRule(line)) continue;
		if (line.startsWith('|')) rows.push(splitRow(line));
		else if (rows.length) break;
	}
	return rows.length ? rectangle(rows) : undefined;
}

/**
 * The table in what was pasted: a Markdown one, or failing that what a spreadsheet copies, or rows
 * written with pipes. The first row is the header. `undefined` when nothing in it reads as a table.
 */
export function parse(text: string): TableData | undefined {
	const normalized = text.replace(/\r\n?/g, '\n');
	if (!normalized.trim()) return undefined;

	const markdown = parseMarkdown(normalized);
	if (markdown) return markdown;

	if (normalized.includes('\t')) {
		const rows = splitDelimited(normalized.replace(/^\n+|\n+$/g, ''), '\t');
		if (rows.length) return alignNumbers(rectangle(rows));
	}

	return pipeRows(normalized.split('\n')) ?? csv(normalized.trim());
}

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : undefined;

/** The characters a person sees, an emoji with its modifiers or a letter with its accent as one. */
export function graphemes(text: string): string[] {
	return segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text);
}

/** Whether a character takes two columns of a monospaced font: Chinese, Japanese, Korean, emoji. */
function wide(grapheme: string): boolean {
	const code = grapheme.codePointAt(0) ?? 0;
	return (
		(code >= 0x1100 && code <= 0x115f) ||
		(code >= 0x2e80 && code <= 0xa4cf) ||
		(code >= 0xac00 && code <= 0xd7a3) ||
		(code >= 0xf900 && code <= 0xfaff) ||
		(code >= 0xfe30 && code <= 0xfe4f) ||
		(code >= 0xff00 && code <= 0xff60) ||
		(code >= 0xffe0 && code <= 0xffe6) ||
		(code >= 0x1f300 && code <= 0x1faff) ||
		(code >= 0x20000 && code <= 0x3fffd)
	);
}

/** How many columns of a monospaced font the text takes, which is what the padding lines up. */
function width(text: string): number {
	let total = 0;
	for (const grapheme of graphemes(text)) total += wide(grapheme) ? 2 : 1;
	return total;
}

function pad(text: string, size: number, align: Align): string {
	const gap = Math.max(0, size - width(text));
	if (align === 'right') return ' '.repeat(gap) + text;
	if (align === 'center') return ' '.repeat(Math.floor(gap / 2)) + text + ' '.repeat(Math.ceil(gap / 2));
	return text + ' '.repeat(gap);
}

function rule(align: Align, size: number): string {
	if (align === 'center') return `:${'-'.repeat(size - 2)}:`;
	if (align === 'right') return `${'-'.repeat(size - 1)}:`;
	if (align === 'left') return `:${'-'.repeat(size - 1)}`;
	return '-'.repeat(size);
}

/** A cell as a Markdown table holds it: on one line, with its pipes escaped. */
function escape(cell: string): string {
	return cell.trim().replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
}

/** The table as GitHub's Markdown, every column padded to the width of its longest cell. */
export function toMarkdown({ cells, align }: TableData): string {
	const rows = cells.map((row) => row.map(escape));
	// Three is the shortest a delimiter can be and still say how its column lines up: `:-:`.
	const widths = align.map((_, column) => Math.max(3, ...rows.map((row) => width(row[column] ?? ''))));

	const line = (row: string[]) =>
		`| ${widths.map((size, column) => pad(row[column] ?? '', size, align[column])).join(' | ')} |`;
	const delimiters = `| ${widths.map((size, column) => rule(align[column], size)).join(' | ')} |`;

	return [line(rows[0] ?? []), delimiters, ...rows.slice(1).map(line)].join('\n');
}
