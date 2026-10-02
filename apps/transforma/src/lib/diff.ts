// What a prompt took out of the text and what it put in, word by word, for the changes view: the
// text as it is now, with what went interleaved where it was.

export interface Segment {
	kind: 'same' | 'removed' | 'added';
	text: string;
}

export interface Changes {
	segments: Segment[];
	/** How many words went, and how many came: a word replaced is one of each. */
	removed: number;
	added: number;
}

/**
 * How long working the changes out may take, in milliseconds. Long, very different texts can take
 * a while; past this, what is left to compare shows as taken out and put in whole.
 */
const TIME_LIMIT = 1000;

/** A stretch of tokens: of the text before when `removed`, of the text after otherwise. */
interface Edit {
	kind: Segment['kind'];
	start: number;
	end: number;
}

/** Words, runs of whitespace, and every other mark — a comma, an emoji — on its own. */
const segmenter =
	typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('es', { granularity: 'word' }) : undefined;

/** The same, for a browser without `Intl.Segmenter`. */
const TOKEN =
	/\s+|[\p{L}\p{M}\p{N}_]+(?:['’][\p{L}\p{M}\p{N}_]+)*|[\u{1F1E6}-\u{1F1FF}]{2}|\S[\p{M}\u{1F3FB}-\u{1F3FF}]*(?:‍\S[\p{M}\u{1F3FB}-\u{1F3FF}]*)*/gu;

const WHITESPACE = /^\s+$/;

function tokenize(text: string): string[] {
	const pieces = segmenter
		? Array.from(segmenter.segment(text), (piece) => piece.segment)
		: (text.match(TOKEN) ?? []);

	// The segmenter cuts whitespace at every line break: the whole run is one token.
	const tokens: string[] = [];
	for (const piece of pieces) {
		const last = tokens.length - 1;
		if (last >= 0 && WHITESPACE.test(piece) && WHITESPACE.test(tokens[last])) tokens[last] += piece;
		else tokens.push(piece);
	}
	return tokens;
}

/**
 * What a token is compared by. Whitespace counts only by the lines it breaks: two spaces where
 * there was one is no change worth showing, a paragraph joined to the next is.
 */
function keyOf(token: string): string {
	if (!WHITESPACE.test(token)) return token;
	const breaks = token.split('\n').length - 1;
	return breaks ? '\n'.repeat(breaks) : ' ';
}

function isWord(token: string): boolean {
	return /[\p{L}\p{N}]/u.test(token);
}

/** What changed from `before` to `after`, word by word. */
export function compare(before: string, after: string): Changes {
	const a = tokenize(before);
	const b = tokenize(after);

	// Compared as numbers, one per distinct token, which is much faster than as strings.
	const ids = new Map<string, number>();
	const idOf = (token: string) => {
		const key = keyOf(token);
		let id = ids.get(key);
		if (id === undefined) ids.set(key, (id = ids.size));
		return id;
	};

	const edits: Edit[] = [];
	diff(Int32Array.from(a, idOf), 0, a.length, Int32Array.from(b, idOf), 0, b.length, edits, Date.now() + TIME_LIMIT);

	const runs: Segment[] = [];
	let removed = 0;
	let added = 0;
	for (const { kind, start, end } of edits) {
		const tokens = (kind === 'removed' ? a : b).slice(start, end);
		if (kind !== 'same') {
			const words = tokens.filter(isWord).length;
			if (kind === 'removed') removed += words;
			else added += words;
		}

		const text = tokens.join('');
		const last = runs.at(-1);
		if (last?.kind === kind) last.text += text;
		else runs.push({ kind, text });
	}

	return { segments: tidy(runs), removed, added };
}

/**
 * Easier to read: every stretch of changes as what went followed by what came, and a space between
 * two changes made part of them, so that «el perro» becoming «un gato» shows as one change rather
 * than two. A line break between them is left alone: each paragraph keeps its own changes.
 */
function tidy(runs: Segment[]): Segment[] {
	const segments: Segment[] = [];
	let removed = '';
	let added = '';

	const flush = () => {
		if (removed) segments.push({ kind: 'removed', text: removed });
		if (added) segments.push({ kind: 'added', text: added });
		removed = added = '';
	};

	runs.forEach((run, i) => {
		const between =
			run.kind === 'same' &&
			/^[^\S\n]+$/.test(run.text) &&
			runs[i - 1]?.kind !== 'same' &&
			runs[i + 1] !== undefined &&
			runs[i + 1].kind !== 'same';

		if (run.kind === 'same' && !between) {
			flush();
			segments.push(run);
			return;
		}
		if (run.kind !== 'added') removed += run.text;
		if (run.kind !== 'removed') added += run.text;
	});
	flush();
	return segments;
}

/** Appends the edits that turn a[aStart, aEnd) into b[bStart, bEnd). */
function diff(
	a: Int32Array,
	aStart: number,
	aEnd: number,
	b: Int32Array,
	bStart: number,
	bEnd: number,
	edits: Edit[],
	deadline: number
) {
	// What both begin and end with needs no working out.
	let prefix = 0;
	while (aStart + prefix < aEnd && bStart + prefix < bEnd && a[aStart + prefix] === b[bStart + prefix]) {
		prefix++;
	}
	let suffix = 0;
	while (
		aEnd - suffix > aStart + prefix &&
		bEnd - suffix > bStart + prefix &&
		a[aEnd - suffix - 1] === b[bEnd - suffix - 1]
	) {
		suffix++;
	}

	if (prefix) edits.push({ kind: 'same', start: bStart, end: bStart + prefix });
	aStart += prefix;
	bStart += prefix;
	aEnd -= suffix;
	bEnd -= suffix;

	const split = aStart < aEnd && bStart < bEnd ? bisect(a, aStart, aEnd, b, bStart, bEnd, deadline) : undefined;
	if (split) {
		const [x, y] = split;
		diff(a, aStart, x, b, bStart, y, edits, deadline);
		diff(a, x, aEnd, b, y, bEnd, edits, deadline);
	} else {
		// One of them is empty, they share nothing, or there is no time left to find out.
		if (aStart < aEnd) edits.push({ kind: 'removed', start: aStart, end: aEnd });
		if (bStart < bEnd) edits.push({ kind: 'added', start: bStart, end: bEnd });
	}

	if (suffix) edits.push({ kind: 'same', start: bEnd, end: bEnd + suffix });
}

/**
 * Where the shortest way from a to b crosses its middle — Myers' «middle snake» — worked out from
 * both ends at once, which keeps the memory to the length of the texts: the rest is two smaller
 * problems, one on each side of it. The way diff-match-patch does it. Undefined when the two share
 * nothing, or the time ran out.
 */
function bisect(
	a: Int32Array,
	aStart: number,
	aEnd: number,
	b: Int32Array,
	bStart: number,
	bEnd: number,
	deadline: number
): [number, number] | undefined {
	const n = aEnd - aStart;
	const m = bEnd - bStart;
	const maxD = Math.ceil((n + m) / 2);
	const offset = maxD;
	const size = 2 * maxD;
	// How far along `a` each diagonal got, from the start and from the end; -1 where none went yet.
	const forward = new Int32Array(size).fill(-1);
	const reverse = new Int32Array(size).fill(-1);
	forward[offset + 1] = 0;
	reverse[offset + 1] = 0;
	const delta = n - m;
	// With an odd difference in length the forward paths are the ones to reach the reverse ones.
	const front = delta % 2 !== 0;
	// Diagonals that ran off the grid, at either end, are not walked again.
	let k1start = 0;
	let k1end = 0;
	let k2start = 0;
	let k2end = 0;

	for (let d = 0; d < maxD; d++) {
		if (Date.now() > deadline) return undefined;

		for (let k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
			const i = offset + k1;
			let x1 = k1 === -d || (k1 !== d && forward[i - 1] < forward[i + 1]) ? forward[i + 1] : forward[i - 1] + 1;
			let y1 = x1 - k1;
			while (x1 < n && y1 < m && a[aStart + x1] === b[bStart + y1]) {
				x1++;
				y1++;
			}
			forward[i] = x1;

			if (x1 > n) k1end += 2;
			else if (y1 > m) k1start += 2;
			else if (front) {
				const j = offset + delta - k1;
				if (j >= 0 && j < size && reverse[j] !== -1 && x1 >= n - reverse[j]) {
					return split(aStart, aEnd, bStart, bEnd, aStart + x1, bStart + y1);
				}
			}
		}

		for (let k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
			const i = offset + k2;
			let x2 = k2 === -d || (k2 !== d && reverse[i - 1] < reverse[i + 1]) ? reverse[i + 1] : reverse[i - 1] + 1;
			let y2 = x2 - k2;
			while (x2 < n && y2 < m && a[aEnd - x2 - 1] === b[bEnd - y2 - 1]) {
				x2++;
				y2++;
			}
			reverse[i] = x2;

			if (x2 > n) k2end += 2;
			else if (y2 > m) k2start += 2;
			else if (!front) {
				const j = offset + delta - k2;
				if (j >= 0 && j < size && forward[j] !== -1) {
					const x1 = forward[j];
					const y1 = x1 - (j - offset);
					if (x1 >= n - x2) return split(aStart, aEnd, bStart, bEnd, aStart + x1, bStart + y1);
				}
			}
		}
	}
	return undefined;
}

/** The point to split at, unless it is a corner, which would leave the same problem to solve again. */
function split(aStart: number, aEnd: number, bStart: number, bEnd: number, x: number, y: number) {
	const corner = (x === aStart && y === bStart) || (x === aEnd && y === bEnd);
	return corner ? undefined : ([x, y] as [number, number]);
}
