// What something said does to the list, decided by the chat model. It is shown the list as it is,
// numbered in the order it is on screen, plus what Whisper heard, and it answers with actions that
// can only take the shapes in `SCHEMA`: Groq's strict mode holds the output to it token by token.
import { complete, LIST_MODEL } from './groq';
import type { Change, Item } from './list.svelte';

export interface Decision {
	/** What to do, already pointing at items by id. */
	changes: Change[];
	/** The user asked to take back the last change. */
	undo: boolean;
	/** Actions left out because they point at no item on the list. */
	missed: number;
	/** One sentence for the user: what was done, or why nothing was. */
	reply: string;
}

const INSTRUCTIONS = [
	'You keep a single checklist that the user edits only by voice. You get the list as it is now ' +
		'and what the user just said, transcribed by speech recognition: expect misheard words, missing ' +
		'punctuation and filler words. Work out what the user wants done to the list and answer with ' +
		'the actions that do it.',
	'',
	'Actions, applied in order:',
	'- add: a new item at the end of the list. "text" is the item.',
	'- edit: "text" replaces the text of item number "item".',
	'- remove: deletes item number "item".',
	'- check / uncheck: marks item number "item" as done / not done.',
	'- clear: deletes every item. There is only ever one list, so starting a new list means clear, ' +
		'then add its items.',
	'- undo: takes back the previous change to the list, when the user asks to undo it. Use it alone.',
	'Fields an action does not use are null.',
	'',
	'Rules:',
	'- Item numbers are the ones in the list below and always refer to it as it is now: they do not ' +
		'shift as your actions are applied.',
	'- Whatever is said without a command is items to add. Split what is listed into one item per ' +
		'thing ("leche, huevos y pan" is three items), but keep together the words that describe one ' +
		'thing ("dos kilos de tortillas", "pan para hot dogs").',
	'- Write items the way someone writes them on a list: short, starting with a capital letter, ' +
		'without filler words or the command itself ("agrega", "también", "por favor"). Keep the user\'s ' +
		'language; never translate.',
	'- Find the items the user refers to by meaning and by sound, since words may be misheard: ' +
		'"quita el pan" removes "Pan integral". Ordinals and numbers ("el tercero", "el número dos") ' +
		'are positions in the list.',
	'- "Ya compré…", "ya tengo…", "ya está…", "palomea…", "tacha…" and "marca…" mean check.',
	'- Do not add what is already on the list: if it is there and done, uncheck it instead.',
	'- If what was said is silence, noise, unrelated to the list, or one of the phrases speech ' +
		'recognition makes up out of silence ("Gracias.", "Subtítulos realizados por la comunidad de ' +
		'Amara.org"), do nothing.',
	'- If it is unclear what the user wants, or it cannot be done with these actions, do nothing ' +
		'and say why.',
	'',
	'"reply" is one short sentence for the user, in the language they spoke, saying what you did or ' +
		'why you did nothing. Plain text, no Markdown.'
].join('\n');

const SCHEMA = {
	type: 'object',
	properties: {
		actions: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					op: { type: 'string', enum: ['add', 'edit', 'remove', 'check', 'uncheck', 'clear', 'undo'] },
					item: { type: ['integer', 'null'] },
					text: { type: ['string', 'null'] }
				},
				required: ['op', 'item', 'text'],
				additionalProperties: false
			}
		},
		reply: { type: 'string' }
	},
	required: ['actions', 'reply'],
	additionalProperties: false
};

/** Decides what `heard` does to `shown`, the list as it is on screen right now. */
export async function decide(apiKey: string, shown: Item[], heard: string): Promise<Decision> {
	const content = await complete(apiKey, {
		model: LIST_MODEL,
		messages: [
			{ role: 'system', content: INSTRUCTIONS },
			{ role: 'user', content: describe(shown, heard) }
		],
		response_format: {
			type: 'json_schema',
			json_schema: { name: 'list_actions', strict: true, schema: SCHEMA }
		},
		// Enough thought to split a list and match «el pan» with «Pan integral», without making
		// whoever is holding the phone wait for it.
		reasoning_effort: 'medium',
		// Only the answer is read; the reasoning would be one more thing to download.
		include_reasoning: false,
		// A long dictated list is one action per item, on top of the reasoning.
		max_completion_tokens: 8192
	});

	return parse(content, shown);
}

function describe(shown: Item[], heard: string): string {
	const lines = shown.map((item, index) => `${index + 1}. [${item.done ? 'x' : ' '}] ${item.text}`);
	return `The list:\n${lines.join('\n') || '(empty)'}\n\nWhat the user said:\n${JSON.stringify(heard)}`;
}

interface Action {
	op?: unknown;
	item?: unknown;
	text?: unknown;
}

/**
 * Strict mode holds the answer to the schema; the item numbers it points at are checked here, and
 * anything that does not point at an item on the list is left out.
 */
function parse(content: string, shown: Item[]): Decision {
	let answer: { actions?: unknown; reply?: unknown };
	try {
		answer = JSON.parse(content) ?? {};
	} catch {
		throw new Error('No se entendió la respuesta de Groq.');
	}

	const changes: Change[] = [];
	let undo = false;
	let missed = 0;

	for (const action of Array.isArray(answer.actions) ? (answer.actions as Action[]) : []) {
		const text = typeof action?.text === 'string' ? action.text.replace(/\s+/g, ' ').trim() : '';
		const target = typeof action?.item === 'number' ? shown[action.item - 1] : undefined;
		if (!target && ['edit', 'remove', 'check', 'uncheck'].includes(String(action?.op))) missed++;

		switch (action?.op) {
			case 'add':
				if (text) changes.push({ op: 'add', text });
				break;
			case 'edit':
				if (target && text) changes.push({ op: 'edit', id: target.id, text });
				break;
			case 'remove':
				if (target) changes.push({ op: 'remove', id: target.id });
				break;
			case 'check':
			case 'uncheck':
				if (target) changes.push({ op: 'check', id: target.id, done: action.op === 'check' });
				break;
			case 'clear':
				changes.push({ op: 'clear' });
				break;
			case 'undo':
				undo = true;
				break;
		}
	}

	return { changes, undo, missed, reply: typeof answer.reply === 'string' ? answer.reply.trim() : '' };
}
