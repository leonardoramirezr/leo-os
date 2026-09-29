// Anki's card templates — {{Field}}, {{#Field}}…{{/Field}}, {{^Field}}…{{/Field}}, filters and cloze
// deletions — rendered the way Anki renders them, into HTML that `text.ts` then reads as plain text.
//
// Every note field's value comes out between two private-use characters, and every section that
// shows between two more. They are how the reading side tells what a card says of its own from what
// the template writes on every card alike, and they are gone before any text reaches a card.

export const FIELD_START = '\uE000';
export const FIELD_END = '\uE001';
export const SECTION_START = '\uE002';
export const SECTION_END = '\uE003';

export type Node =
	| { kind: 'text'; text: string }
	/** `repeat`: the same field just before it, with nothing to read in between. */
	| { kind: 'field'; name: string; filters: string[]; repeat: boolean }
	| { kind: 'section'; name: string; inverted: boolean; children: Node[] };

export interface Context {
	/** The note's own fields, by name. */
	fields: Map<string, string>;
	/** Anki's fields about the card rather than the note: Tags, Deck, Card… */
	special: Map<string, string>;
	/** Which cloze deletion the card asks for, starting at 1. */
	cloze: number;
	side: 'question' | 'answer';
	/** Set when the card's cloze deletion turns up in what was rendered. */
	found?: boolean;
}

const TAG = /\{\{([\s\S]*?)\}\}/g;

/** Anki's own test: nothing but spaces, line breaks and empty divs. */
const EMPTY = /^(?:\s|<\/?(?:br|div) ?\/?>)*$/i;

/** `漢字[かんじ]`, as the furigana filters read it: a reading in brackets after its word. */
const FURIGANA = / ?([^ >]+?)\[(.+?)\]/g;

const COMMENT = /<!--[\s\S]*?-->/g;
const STYLE = /<style\b[\s\S]*?<\/style\s*>/gi;
const SCRIPT = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;

/** What a template tag is about: `{{text:Front}}` is about the field Front. */
function fieldOf(tag: string): string {
	return tag.split(':').pop()!.trim();
}

/**
 * Every field a template names. In a script a field may be put to any use, shown or not, so those
 * only count when asked for.
 */
export function fieldsIn(source: string, scripts = false): Set<string> {
	const markup = scripts ? source.replace(COMMENT, '') : source.replace(COMMENT, '').replace(SCRIPT, '');
	const names = new Set<string>();
	for (const [, tag] of markup.matchAll(TAG)) {
		const inner = tag.trim();
		if (!/^[#^/]/.test(inner)) names.add(fieldOf(inner));
	}
	return names;
}

/** The fields the template has typed in (`{{type:Back}}`), whose content is what the card asks for. */
export function typedIn(source: string): string[] {
	return [...source.replace(COMMENT, '').matchAll(TAG)]
		.map(([, tag]) => tag.trim().split(':'))
		.filter((parts) => parts.length > 1 && parts.slice(0, -1).some((filter) => filter.trim() === 'type'))
		.map((parts) => parts[parts.length - 1].trim());
}

/**
 * Parses a template. Comments and styles go. Scripts go too, but many templates write the answer
 * from one — the fields inside a template string that a script puts on the page — so `reveal` says
 * which of the fields a script names are to be shown as they are, each on a line of its own. The
 * sections it opens and closes always stay, so that the ones around it still match.
 */
export function compile(source: string, reveal: (field: string) => boolean = () => false): Node[] {
	const markup = source
		.replace(COMMENT, '')
		.replace(STYLE, '')
		.replace(SCRIPT, (_, code: string) =>
			[...code.matchAll(TAG)]
				.map(([whole, tag]) => {
					const inner = tag.trim();
					if (/^[#^/]/.test(inner)) return whole;
					return reveal(fieldOf(inner)) ? `<div>${whole}</div>` : '';
				})
				.join('')
		);
	return markRepeats(parse(markup));
}

function parse(source: string): Node[] {
	const root: Node[] = [];
	const open: { name: string; children: Node[] }[] = [{ name: '', children: root }];
	let last = 0;

	for (const match of source.matchAll(TAG)) {
		const current = open[open.length - 1].children;
		if (match.index > last) current.push({ kind: 'text', text: source.slice(last, match.index) });
		last = match.index + match[0].length;

		const inner = match[1].trim();
		if (inner.startsWith('#') || inner.startsWith('^')) {
			const section: Node = {
				kind: 'section',
				name: inner.slice(1).trim(),
				inverted: inner.startsWith('^'),
				children: []
			};
			current.push(section);
			open.push(section);
		} else if (inner.startsWith('/')) {
			// Anki refuses a template whose sections do not match. Here the nearest one open by that name
			// closes, with whatever opened inside it, and a close that matches nothing is dropped.
			const name = inner.slice(1).trim();
			const at = open.findLastIndex((section, index) => index > 0 && section.name === name);
			if (at > 0) open.length = at;
		} else {
			const filters = inner.split(':');
			const name = filters.pop()!.trim();
			current.push({ kind: 'field', name, filters: filters.map((f) => f.trim()), repeat: false });
		}
	}
	if (last < source.length) {
		open[open.length - 1].children.push({ kind: 'text', text: source.slice(last) });
	}
	return root;
}

/**
 * Some templates show a field several times running, in a different font each: once is enough for
 * text, which has no fonts.
 */
function markRepeats(nodes: Node[]): Node[] {
	let previous: Extract<Node, { kind: 'field' }> | undefined;
	for (const node of nodes) {
		if (node.kind === 'section') {
			markRepeats(node.children);
			previous = undefined;
		} else if (node.kind === 'text') {
			if (node.text.replace(/<[^>]*>|&nbsp;/g, '').trim()) previous = undefined;
		} else {
			node.repeat =
				previous !== undefined &&
				previous.name === node.name &&
				previous.filters.join(':') === node.filters.join(':');
			previous = node;
		}
	}
	return nodes;
}

function lookup(context: Context, name: string): { value: string; own: boolean } | undefined {
	// Anki's special fields win over a note field that happens to share their name.
	const special = context.special.get(name);
	if (special !== undefined) return { value: special, own: false };
	const value = context.fields.get(name);
	if (value !== undefined) return { value, own: true };

	// Anki matches names exactly; a template that got the case wrong is taken as meant.
	const lower = name.toLowerCase();
	for (const [field, text] of context.fields) {
		if (field.toLowerCase() === lower) return { value: text, own: true };
	}
	return undefined;
}

export function render(nodes: Node[], context: Context): string {
	let html = '';
	for (const node of nodes) {
		if (node.kind === 'text') {
			html += node.text;
		} else if (node.kind === 'section') {
			const found = lookup(context, node.name);
			if (EMPTY.test(found?.value ?? '') !== node.inverted) continue;
			// What shows because of the note's own fields is the note's; `{{#Tags}}` is every card's.
			const inner = render(node.children, context);
			html += found?.own ? SECTION_START + inner + SECTION_END : inner;
		} else if (!node.repeat) {
			const found = lookup(context, node.name);
			if (!found) continue;
			const value = node.filters.reduceRight((text, filter) => apply(filter, text, context), found.value);
			if (value.trim()) html += found.own ? FIELD_START + value + FIELD_END : value;
		}
	}
	return html;
}

function apply(filter: string, text: string, context: Context): string {
	switch (filter) {
		case 'text':
			return text.replace(/<[^>]*>/g, '');
		case 'cloze':
			return cloze(text, context, false);
		case 'cloze-only':
			return cloze(text, context, true);
		case 'type':
			// A box to type the answer in, and on the answer side what should have been typed.
			return context.side === 'question' ? '' : text;
		case 'kanji':
		case 'kana':
		case 'furigana':
			return text.replace(/&nbsp;/g, ' ').replace(FURIGANA, (all, word: string, reading: string) => {
				if (reading.startsWith('sound:')) return all;
				if (filter === 'kanji') return word;
				if (filter === 'kana') return reading;
				return `<ruby><rb>${word}</rb><rt>${reading}</rt></ruby>`;
			});
		default:
			// Text to speech is a button that reads aloud, which a card of text has no use for. Any other
			// filter — `hint`, or one an add-on brings — shows the field as it is.
			return filter === 'tts' || filter.startsWith('tts ') ? '' : text;
	}
}

interface Deletion {
	numbers: number[];
	content: (string | Deletion)[];
	hint?: string;
}

/** Cloze deletions, which may nest: `{{c1::Canberra}}`, `{{c2::a {{c1::b}}::hint}}`. */
function parseCloze(text: string): (string | Deletion)[] {
	const root: (string | Deletion)[] = [];
	const open: Deletion[] = [];
	const add = (part: string | Deletion) => {
		const current = open[open.length - 1];
		if (current?.hint !== undefined && typeof part === 'string') current.hint += part;
		else (current ? current.content : root).push(part);
	};

	let last = 0;
	for (const match of text.matchAll(/\{\{c(\d+(?:,\d+)*)::|::|\}\}/g)) {
		add(text.slice(last, match.index));
		last = match.index + match[0].length;

		const current = open[open.length - 1];
		if (match[1]) open.push({ numbers: match[1].split(',').map(Number), content: [] });
		else if (match[0] === '::' && current && current.hint === undefined) current.hint = '';
		else if (match[0] === '}}' && current) {
			open.pop();
			add(current);
		} else add(match[0]);
	}
	add(text.slice(last));

	// One never closed is text, as Anki shows it.
	while (open.length) {
		const unclosed = open.pop()!;
		const hint = unclosed.hint === undefined ? '' : `::${unclosed.hint}`;
		add(`{{c${unclosed.numbers.join(',')}::${reveal(unclosed.content)}${hint}`);
	}
	return root;
}

function reveal(parts: (string | Deletion)[]): string {
	return parts.map((part) => (typeof part === 'string' ? part : reveal(part.content))).join('');
}

/**
 * The question hides the card's deletion as «[…]», or as its hint, and shows the others. The answer
 * is what was hidden and nothing else: the card's back already shows the question above it. With
 * the deletion several times over, the answer is all of them.
 */
function cloze(text: string, context: Context, only: boolean): string {
	const parts = parseCloze(text);

	if (context.side === 'question' && !only) {
		const hide = (items: (string | Deletion)[]): string =>
			items
				.map((part) => {
					if (typeof part === 'string') return part;
					if (!part.numbers.includes(context.cloze)) return hide(part.content);
					context.found = true;
					return `[${part.hint?.trim() || '…'}]`;
				})
				.join('');
		return hide(parts);
	}

	const answers: string[] = [];
	const collect = (items: (string | Deletion)[]) => {
		for (const part of items) {
			if (typeof part === 'string') continue;
			if (part.numbers.includes(context.cloze)) answers.push(reveal(part.content));
			else collect(part.content);
		}
	};
	collect(parts);
	if (answers.length) context.found = true;
	return answers.join(', ');
}
