// A cell's own Markdown, read the way GitHub shows it, for the image: what is between `**` comes out
// bold rather than with its asterisks. Only what a table cell can hold is read — emphasis, code,
// strikethrough, links and `<br>` — and anything left unclosed stays as it was typed.

export interface Run {
	text: string;
	bold?: boolean;
	italic?: boolean;
	code?: boolean;
	strike?: boolean;
	link?: boolean;
}

type Format = Omit<Run, 'text'>;

/** Where a `<br>` was: a line ends there. */
const BREAK = null;

/** What `\` may escape, as CommonMark has it. */
const ESCAPABLE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	'#39': "'"
};

/** The emphasis marks, longest first so that `**` is not read as two `*`. */
const MARKS: [string, keyof Format][] = [
	['**', 'bold'],
	['__', 'bold'],
	['~~', 'strike'],
	['*', 'italic'],
	['_', 'italic'],
	['~', 'strike']
];

const WORD = /[\p{L}\p{N}]/u;

/**
 * Where the emphasis opened at `start` closes, or -1. The text inside may not start or end with a
 * space, and an underscore inside a word (snake_case) is not one.
 */
function closing(source: string, start: number, mark: string): number {
	const from = start + mark.length;
	if (from >= source.length || /\s/.test(source[from])) return -1;
	if (mark[0] === '_' && start > 0 && WORD.test(source[start - 1])) return -1;

	for (let at = source.indexOf(mark, from + 1); at !== -1; at = source.indexOf(mark, at + 1)) {
		// Part of a longer run of the same mark: `***` closes `**` one character later.
		if (source[at + mark.length] === mark[0]) continue;
		if (mark.length === 1 && source[at - 1] === mark) continue;
		if (/\s/.test(source[at - 1]) || source[at - 1] === '\\') continue;
		if (mark[0] === '_' && WORD.test(source[at + mark.length] ?? '')) continue;
		return at;
	}
	return -1;
}

function scan(source: string, format: Format, out: (Run | typeof BREAK)[]) {
	let text = '';
	const flush = () => {
		if (text) out.push({ ...format, text });
		text = '';
	};

	let i = 0;
	outer: while (i < source.length) {
		const char = source[i];
		const rest = source.slice(i);

		if (char === '\\' && ESCAPABLE.test(source[i + 1] ?? '')) {
			text += source[i + 1];
			i += 2;
			continue;
		}

		const lineBreak = /^<br\s*\/?>/i.exec(rest);
		if (lineBreak) {
			flush();
			out.push(BREAK);
			i += lineBreak[0].length;
			continue;
		}

		const entity = /^&(#?\w+);/.exec(rest);
		if (entity && ENTITIES[entity[1]] !== undefined) {
			text += ENTITIES[entity[1]];
			i += entity[0].length;
			continue;
		}

		if (char === '`') {
			const ticks = /^`+/.exec(rest)![0];
			const end = source.indexOf(ticks, i + ticks.length);
			if (end !== -1) {
				flush();
				const code = source.slice(i + ticks.length, end).replace(/^ (.*) $/, '$1');
				out.push({ ...format, code: true, text: code || ' ' });
				i = end + ticks.length;
			} else {
				text += ticks;
				i += ticks.length;
			}
			continue;
		}

		// A link shows its text; an image, what it says it shows.
		const link = /^!?\[((?:\\.|[^\]\\])*)\]\(([^)]*)\)/.exec(rest);
		if (link) {
			flush();
			scan(link[1], char === '!' ? format : { ...format, link: true }, out);
			i += link[0].length;
			continue;
		}

		for (const [mark, key] of MARKS) {
			if (!rest.startsWith(mark)) continue;
			const end = closing(source, i, mark);
			if (end === -1) break;
			flush();
			scan(source.slice(i + mark.length, end), { ...format, [key]: true }, out);
			i = end + mark.length;
			continue outer;
		}

		text += char;
		i++;
	}
	flush();
}

/** A cell's lines, each one the runs of text it is made of. Always at least one line. */
export function inline(source: string): Run[][] {
	const pieces: (Run | typeof BREAK)[] = [];
	scan(source, {}, pieces);

	const lines: Run[][] = [[]];
	for (const piece of pieces) {
		if (piece === BREAK) lines.push([]);
		else lines[lines.length - 1].push(piece);
	}
	return lines;
}
