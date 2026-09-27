// What an Anki package (.apkg) holds: a zip with the collection, which is an SQLite database, and
// the images and audio its cards show — which Repaso, whose cards are text, never reads.
//
// AnkiWeb hands shared decks out in the two older formats: `collection.anki2`, and since Anki 2.1
// `collection.anki21`, next to a `collection.anki2` whose only card says to update Anki. The newest,
// `collection.anki21b`, is compressed with zstd, which a browser cannot uncompress on its own: a
// package in it is turned down with a way out, exporting it again for older versions of Anki.
import { Database, type Value } from './sqlite';
import { readEntries, readEntry, type ZipEntry } from './zip';

export class PackageError extends Error {
	constructor(readonly reason: 'not-anki' | 'new-format' | 'damaged') {
		super(reason);
		this.name = 'PackageError';
	}
}

export interface Notetype {
	name: string;
	cloze: boolean;
	fields: string[];
	/** A cloze note type has one, shared by every deletion. */
	templates: { name: string; question: string; answer: string }[];
	css: string;
}

export interface Note {
	notetype: number;
	fields: string[];
	/** Separated by spaces, as Anki keeps them. */
	tags: string;
}

export interface Card {
	id: number;
	note: number;
	deck: number;
	/** Which of the note type's templates it is, or for a cloze note which deletion, from 0. */
	ord: number;
	/** A new card's place in the queue. */
	position: number;
	isNew: boolean;
}

export interface Package {
	/** Every deck's full name, `Parent::Child`, by id. */
	decks: Map<number, string>;
	notetypes: Map<number, Notetype>;
	notes: Map<number, Note>;
	cards: Card[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function number(value: Value | undefined): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function json(value: Value | undefined): Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(text(value));
		return isRecord(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

/** Anki keeps fields and templates with their place in the note type, which is what orders them. */
function ordered(value: unknown): Record<string, unknown>[] {
	if (!Array.isArray(value)) return [];
	return value.filter(isRecord).toSorted((a, b) => number(a.ord as Value) - number(b.ord as Value));
}

export async function readPackage(file: Blob): Promise<Package> {
	let entries: Map<string, ZipEntry>;
	try {
		entries = await readEntries(file);
	} catch {
		// A zip whose end never arrived is a download cut short, rather than some other file.
		const start = new Uint8Array(await file.slice(0, 4).arrayBuffer());
		const zip = start[0] === 0x50 && start[1] === 0x4b && start[2] === 3 && start[3] === 4;
		throw new PackageError(zip ? 'damaged' : 'not-anki');
	}

	if (entries.has('collection.anki21b') && !entries.has('collection.anki21')) {
		throw new PackageError('new-format');
	}
	const entry = entries.get('collection.anki21') ?? entries.get('collection.anki2');
	if (!entry) throw new PackageError('not-anki');

	try {
		return collection(new Database(await readEntry(file, entry)));
	} catch (error) {
		if (error instanceof PackageError) throw error;
		throw new PackageError('damaged');
	}
}

function collection(database: Database): Package {
	if (!['col', 'notes', 'cards'].every((table) => database.has(table))) {
		throw new PackageError('not-anki');
	}

	const [col] = database.rows('col');
	const models = json(col?.models);
	if (!Object.keys(models).length) {
		// From Anki 2.1.28 on, a collection keeps its note types in tables of their own, in protobuf.
		// Only a package in the newest format would hold one like that.
		throw new PackageError(database.has('notetypes') ? 'new-format' : 'damaged');
	}

	const notetypes = new Map<number, Notetype>();
	for (const [id, model] of Object.entries(models)) {
		if (!isRecord(model)) continue;
		notetypes.set(Number(id), {
			name: text(model.name),
			cloze: model.type === 1,
			fields: ordered(model.flds).map((field) => text(field.name)),
			templates: ordered(model.tmpls).map((template) => ({
				name: text(template.name),
				question: text(template.qfmt),
				answer: text(template.afmt)
			})),
			css: text(model.css)
		});
	}

	const decks = new Map<number, string>();
	for (const [id, deck] of Object.entries(json(col?.decks))) {
		if (isRecord(deck)) decks.set(Number(id), text(deck.name));
	}

	const notes = new Map<number, Note>();
	for (const row of database.rows('notes')) {
		notes.set(number(row.id), {
			notetype: number(row.mid),
			fields: text(row.flds).split('\x1f'),
			tags: text(row.tags).trim()
		});
	}

	const cards: Card[] = [];
	for (const row of database.rows('cards')) {
		// A card lent to a filtered deck still belongs to the one it came from.
		const lent = number(row.odid) !== 0;
		cards.push({
			id: number(row.id),
			note: number(row.nid),
			deck: lent ? number(row.odid) : number(row.did),
			ord: number(row.ord),
			position: lent ? number(row.odue) : number(row.due),
			isNew: number(row.type) === 0
		});
	}

	return { decks, notetypes, notes, cards };
}
