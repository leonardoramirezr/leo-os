// From an Anki package to the cards Repaso studies: a front and a back of plain text for each card
// of the package, in the order Anki would bring the new ones.
//
// Some cards have nothing left once images and audio are gone — a picture to name, a recording to
// understand — and some a question with no answer, like the cards that only explain how a deck
// works. Those are counted and left out.
import type { Draft } from '../collection.svelte';
import { readPackage, type Card, type Note, type Notetype, type Package } from './package';
import { compile, fieldsIn, FIELD_END, FIELD_START, render, typedIn, type Node } from './template';
import { hiddenBy, toText } from './text';

export { PackageError } from './package';

export interface Imported {
	/** What to call the deck: the one the package's cards are in, or the one they all descend from. */
	name: string;
	cards: Draft[];
	/** How many cards the package has, left out ones included. */
	total: number;
}

interface Prepared {
	name: string;
	question: Node[];
	answer: Node[];
	/** For a back that comes out empty: the fields typed in, or else the ones only the answer names. */
	fallback: string[];
}

/** Where Anki draws the line between a card's question and the answer shown below it. */
const ANSWER_RULE = /<hr[^>]*\bid\s*=\s*["']?answer\b["']?[^>]*>/i;

/** Cards between pauses, so the screen keeps answering while a large deck is read. */
const BATCH = 100;

/**
 * A moment for the screen to answer. None while the page is hidden: nobody is looking, and there a
 * browser lets a timer fire once a second at most, which would stretch a large deck into minutes.
 */
function pause(): Promise<void> {
	if (document.visibilityState === 'hidden') return Promise.resolve();
	return new Promise((resolve) => setTimeout(resolve));
}

function prepare(notetype: Notetype): Prepared[] {
	const own = new Set(notetype.fields);
	return notetype.templates.map((template) => {
		const asked = fieldsIn(template.question);
		const shown = new Set([...asked, ...fieldsIn(template.answer)]);
		const typed = typedIn(template.question).filter((field) => own.has(field));
		const answered = [...fieldsIn(template.answer, true)].filter(
			(field) => own.has(field) && !asked.has(field)
		);
		return {
			name: template.name,
			question: compile(template.question),
			// A field that the answer's script writes on the page, and that the templates show nowhere else.
			answer: compile(template.answer, (field) => own.has(field) && !shown.has(field)),
			fallback: typed.length ? typed : answered
		};
	});
}

/** Anki lists decks alphabetically, each followed by its subdecks. */
function compareDecks(a: string, b: string): number {
	const left = a.split('::');
	const right = b.split('::');
	for (let i = 0; i < Math.min(left.length, right.length); i++) {
		const order = left[i].localeCompare(right[i], undefined, { sensitivity: 'base', numeric: true });
		if (order) return order;
	}
	return left.length - right.length;
}

/** The deck the cards all belong to, or the deepest one they all descend from. */
function suggestName(decks: string[]): string {
	if (!decks.length) return '';
	const paths = decks.map((name) => name.split('::'));
	const common: string[] = [];
	for (let i = 0; paths.every((path) => i < path.length && path[i] === paths[0][i]); i++) {
		common.push(paths[0][i]);
	}
	const name = (common.at(-1) ?? '').trim();
	return name === 'Default' ? '' : name;
}

function face(card: Card, note: Note, notetype: Notetype, template: Prepared, deck: string, hidden: string) {
	const fields = new Map(notetype.fields.map((name, index) => [name, note.fields[index] ?? '']));
	const context = {
		fields,
		special: new Map([
			// The answer is what the back shows below the question, which Repaso already shows above it.
			['FrontSide', ''],
			['Tags', note.tags],
			['Type', notetype.name],
			['Deck', deck],
			['Subdeck', deck.split('::').at(-1) ?? ''],
			['Card', template.name],
			['CardFlag', '']
		]),
		cloze: card.ord + 1,
		side: 'question' as 'question' | 'answer',
		found: false
	};

	const question = render(template.question, context);
	// A deletion the note no longer has: Anki would call it an empty card.
	if (notetype.cloze && !context.found) return undefined;
	const front = toText(question, hidden, 'question');
	if (!front.own || !front.text) return undefined;

	context.side = 'answer';
	let answer = render(template.answer, context);
	const rule = ANSWER_RULE.exec(answer);
	if (rule) answer = answer.slice(rule.index + rule[0].length);

	let back = toText(answer, hidden, 'answer').text;
	if (!back) {
		// A template whose answer did not survive being read as text: its fields, one to a line.
		const lines = template.fallback
			.map((name) => fields.get(name) ?? '')
			.filter((value) => value.trim())
			.map((value) => `<div>${FIELD_START}${value}${FIELD_END}</div>`);
		back = toText(lines.join(''), hidden, 'answer').text;
	}

	back = withoutQuestion(back, front.text);
	return back ? { front: front.text, back } : undefined;
}

/**
 * The back without the question, when it repeats it on lines of its own: Repaso shows the question
 * above the answer already. Only whole lines count, or «cats» would lose «cat».
 */
function withoutQuestion(back: string, front: string): string {
	const lines = back.split('\n');
	const asked = front.split('\n');
	for (let i = 0; i + asked.length <= lines.length; i++) {
		if (asked.every((line, j) => lines[i + j] === line)) {
			lines.splice(i, asked.length);
			return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
		}
	}
	return back;
}

/** Reads the package and writes its cards as text. Throws a `PackageError` for a file it cannot read. */
export async function readDeck(
	file: Blob,
	progress?: (done: number, total: number) => void
): Promise<Imported> {
	const { decks, notetypes, notes, cards }: Package = await readPackage(file);

	const prepared = new Map<number, { templates: Prepared[]; hidden: string }>();
	for (const [id, notetype] of notetypes) {
		prepared.set(id, { templates: prepare(notetype), hidden: hiddenBy(notetype.css) });
	}

	const deckName = (card: Card) => decks.get(card.deck) ?? '';
	const queue = cards.toSorted(
		(a, b) =>
			compareDecks(deckName(a), deckName(b)) ||
			Number(b.isNew) - Number(a.isNew) ||
			(a.isNew ? a.position - b.position : a.note - b.note) ||
			a.ord - b.ord ||
			a.id - b.id
	);

	const written: Draft[] = [];
	const seen = new Set<string>();
	for (const [index, card] of queue.entries()) {
		if (index % BATCH === 0) {
			progress?.(index, queue.length);
			await pause();
		}

		const note = notes.get(card.note);
		const notetype = note && notetypes.get(note.notetype);
		const types = note && prepared.get(note.notetype);
		if (!note || !notetype || !types) continue;
		// A cloze note type has a single template; its cards differ by the deletion they ask for.
		const template = types.templates[notetype.cloze ? 0 : card.ord];
		if (!template) continue;

		const draft = face(card, note, notetype, template, deckName(card), types.hidden);
		if (!draft) continue;
		// A deck with the same note twice: once is enough.
		const key = `${draft.front}\u0000${draft.back}`;
		if (seen.has(key)) continue;
		seen.add(key);
		written.push(draft);
	}
	progress?.(queue.length, queue.length);

	return {
		name: suggestName([...new Set(queue.map(deckName))]),
		cards: written,
		total: cards.length
	};
}
