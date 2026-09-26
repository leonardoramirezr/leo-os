// Cards written by a chat model on Groq. It is shown the deck, the cards the deck already has and
// what the user wants to learn, and answers with cards in one JSON shape. The models that support
// it are held to that shape token by token (strict mode); the rest only promise valid JSON, and the
// prompt spells the shape out for them.
import type { Draft } from './collection.svelte';
import { complete, GroqError, type ChatRequest } from './groq';

export interface CardRequest {
	/** The deck's name: a hint at what the cards are for, e.g. a language. */
	deck: string;
	/** What the user wants to learn: a topic, a list, or notes pasted in. */
	topic: string;
	count: number;
	/** The fronts of the cards the deck already has, newest first. */
	existing: string[];
}

const INSTRUCTIONS = [
	'You write flashcards for spaced repetition, the kind studied in Anki. You get the deck they go ' +
		'in, the cards it already has, and what the user wants to learn: a topic, a list, or notes ' +
		'pasted in.',
	'',
	'Rules:',
	'- One card, one thing to remember: a fact, a word, a definition, a date, a step. Split anything ' +
		'bigger into several cards.',
	'- "front" asks for it: a question or a cue with a single clear answer, that makes sense on its ' +
		'own. "back" is that answer, as short as it can be: a few words or one sentence. The back ' +
		'never repeats the front.',
	'- With notes, take the facts from the notes. Otherwise, only what is well established: leave ' +
		'out anything you are not sure is true.',
	'- Write in the language the user wrote in. When the deck is for learning another language, the ' +
		'word or phrase in that language goes on the front and its meaning on the back, unless the ' +
		'user asks for something else.',
	'- Plain text: no Markdown, no numbering, no labels such as "Q:" or "A:".',
	'- Do not repeat a card the deck already has, even worded differently.',
	'- Write as many cards as asked for; fewer only if the material runs out.',
	'',
	'Answer with a JSON object and nothing else, shaped {"cards": [{"front": "…", "back": "…"}]}.'
].join('\n');

const SCHEMA = {
	type: 'object',
	properties: {
		cards: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					front: { type: 'string' },
					back: { type: 'string' }
				},
				required: ['front', 'back'],
				additionalProperties: false
			}
		}
	},
	required: ['cards'],
	additionalProperties: false
};

/** How many of the deck's cards the model is shown: the newest, which is where repeats come from. */
const SHOWN_EXISTING = 200;

/**
 * Room for twenty cards plus the reasoning of the models that think before answering, which counts
 * towards the same limit.
 */
const MAX_TOKENS = 8192;

/** Models that turned strict mode down during this visit: they get a plain JSON object straight away. */
const withoutSchema = new Set<string>();

/** New cards for the deck, as many as asked for at most. What the deck already has is left out. */
export async function writeCards(apiKey: string, model: string, request: CardRequest): Promise<Draft[]> {
	const messages: ChatRequest['messages'] = [
		{ role: 'system', content: INSTRUCTIONS },
		{ role: 'user', content: describe(request) }
	];

	let content: string | undefined;
	if (!withoutSchema.has(model)) {
		try {
			content = await complete(apiKey, {
				model,
				messages,
				response_format: {
					type: 'json_schema',
					json_schema: { name: 'flashcards', strict: true, schema: SCHEMA }
				},
				max_completion_tokens: MAX_TOKENS
			});
		} catch (error) {
			// «This model does not support response format `json_schema`»: most of Groq's models do not,
			// and which ones do changes as models come and go.
			const refused =
				error instanceof GroqError &&
				error.status === 400 &&
				/json_schema|response.format/i.test(error.message);
			if (!refused) throw error;
			withoutSchema.add(model);
		}
	}

	content ??= await complete(apiKey, {
		model,
		messages,
		response_format: { type: 'json_object' },
		max_completion_tokens: MAX_TOKENS
	});

	return unseen(parse(content), request.existing).slice(0, request.count);
}

function describe({ deck, topic, count, existing }: CardRequest): string {
	const shown = existing
		.slice(0, SHOWN_EXISTING)
		.map((front) => `- ${front.replace(/\s+/g, ' ').slice(0, 120)}`);
	return [
		`Deck: ${deck}`,
		'',
		'Cards it already has:',
		shown.join('\n') || '(none)',
		'',
		`Write ${count} cards about:`,
		topic
	].join('\n');
}

function parse(content: string): Draft[] {
	// Outside strict mode a model may think out loud first, or wrap the object in a sentence.
	const text = content.replace(/<think>[\s\S]*?<\/think>/g, '');

	let answer: unknown;
	try {
		answer = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
	} catch {
		throw new Error('No se entendió la respuesta de Groq.');
	}

	// Only the prompt names the array outside strict mode: a model that calls it something else still
	// wrote cards.
	const fields = typeof answer === 'object' && answer !== null ? answer : {};
	const cards = 'cards' in fields ? fields.cards : Object.values(fields).find(Array.isArray);
	if (!Array.isArray(cards)) return [];

	return cards.flatMap((card: { front?: unknown; back?: unknown } | null) => {
		const front = tidy(card?.front);
		const back = tidy(card?.back);
		return front && back ? [{ front, back }] : [];
	});
}

function tidy(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\n{3,}/g, '\n\n').trim() : '';
}

/** Leaves out what the deck already has and whatever the model wrote twice. */
function unseen(drafts: Draft[], existing: string[]): Draft[] {
	const seen = new Set(existing.map(normalize));
	return drafts.filter((draft) => {
		const key = normalize(draft.front);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** Case, punctuation and spacing aside: «¿Capital de Francia?» is «capital de francia». */
function normalize(text: string): string {
	return text.toLocaleLowerCase('es').replace(/[\p{P}\p{S}\s]+/gu, ' ').trim();
}
