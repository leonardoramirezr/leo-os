// A routine described in one's own words — typed, or dictated and written down by Whisper — written
// out by a chat model on Groq. The model is shown the catalog and picks every exercise it can from
// it, so that the routine comes with its animations. The editor opens with what it wrote, and
// nothing is saved until it has been looked over there.
import type { RutinaDay, RutinaEntry } from '@leo-os/shared';
import { CATALOG, catalogText, exerciseOf, normalize } from './catalog';
import { parseBlocks } from './effort';
import { completeJSON } from './groq';
import { shortId } from './ids';
import { guess } from './importer';
import { DEFAULTS, LIMITS } from './routine';

/** A routine as the model wrote it: not saved, and with no id of its own yet. */
export interface Written {
	name: string;
	days: RutinaDay[];
}

const INSTRUCTIONS = [
	"You write workout routines for a gym app from a person's description of the routine they want.",
	'It is usually in Spanish, often with exercise names in English, and it may have been dictated and',
	'written down by speech recognition: expect misheard words and missing punctuation.',
	'',
	'You get the app\'s catalog of exercises, one per line as "id: name (other names)", and the',
	'description. It may spell the routine out (days, exercises, sets, repetitions, weights) or only',
	'say what it is for ("3 days a week, full body, beginner"): then design it yourself, with',
	'exercises from the catalog.',
	'',
	'A routine has a name and its days, in order, and each day has its exercises in the order they are',
	'done:',
	'- The routine\'s name: what the description calls it, else a short one that says what it is',
	'  ("Full body 3 días"), in the language of the description.',
	'- A day\'s name: the weekday it is done on, when the description gives one, written in Spanish',
	'  ("Lunes", "Miércoles"), since the app proposes such a day on its weekday; else what the',
	'  description calls it ("Pierna", "Empuje"); else "Día 1", "Día 2" and so on.',
	'- exercise: the id of the catalog exercise it is: the same movement, even if the description adds',
	'  a grip, a tempo, equipment or a note. Empty when the catalog has no exercise that is the same',
	'  movement, rather than a different one.',
	'- name: empty when the catalog exercise\'s name says it all. Otherwise the name to show, in the',
	'  words and the language of the description: for an exercise the catalog does not have, or for a',
	'  variant its name leaves out ("Sentadilla goblet con pausa").',
	'- sets and reps: the number of sets and the repetitions of each. With a range, such as 8 to 12,',
	'  the lower number.',
	'- timed: true for an exercise done against the clock, such as a plank. Its reps are then the',
	'  seconds each set lasts.',
	'- rest_seconds: the rest after each set, in seconds.',
	'- last_block: the weight already being moved, when the description gives it, as "reps@weightkg":',
	'  "8@60kg" for sets of 8 with 60 kg, "12,10,8@40kg" for sets that differ. Pounds are converted to',
	'  kilograms. Empty when no weight is given.',
	'',
	'Fill in what the description leaves out sensibly for its goal. With nothing to go by:',
	`${DEFAULTS.sets} sets of ${DEFAULTS.reps} repetitions (${DEFAULTS.timedReps} seconds against the clock) ` +
		`and ${DEFAULTS.rest} seconds of rest.`,
	'When the text describes no workout at all, answer with no days.',
	'',
	'Answer with a JSON object and nothing else, shaped',
	'{"name": "<routine>", "days": [{"name": "<day>", "exercises": [{"exercise": "<catalog id or empty>",',
	'"name": "", "sets": 3, "reps": 10, "timed": false, "rest_seconds": 90, "last_block": ""}]}]}.'
].join('\n');

const SCHEMA = {
	type: 'object',
	properties: {
		name: { type: 'string' },
		days: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					exercises: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								exercise: { type: 'string', enum: ['', ...CATALOG.map((exercise) => exercise.id)] },
								name: { type: 'string' },
								sets: { type: 'integer' },
								reps: { type: 'integer' },
								timed: { type: 'boolean' },
								rest_seconds: { type: 'integer' },
								last_block: { type: 'string' }
							},
							required: ['exercise', 'name', 'sets', 'reps', 'timed', 'rest_seconds', 'last_block'],
							additionalProperties: false
						}
					}
				},
				required: ['name', 'exercises'],
				additionalProperties: false
			}
		}
	},
	required: ['name', 'days'],
	additionalProperties: false
};

/**
 * Room for a week of training plus the reasoning of the models that think before answering, which
 * counts towards the same limit. Groq refuses to ask a model for more than it can write, and this is
 * what the least of its chat models can.
 */
const MAX_TOKENS = 16_384;

/** The routine `description` describes, written by `model`. Throws when it describes none. */
export async function writeRoutine(apiKey: string, model: string, description: string): Promise<Written> {
	const answer = await completeJSON(apiKey, {
		model,
		messages: [
			{ role: 'system', content: INSTRUCTIONS },
			{ role: 'user', content: ['Catalog:', catalogText(), '', 'Description:', description].join('\n') }
		],
		name: 'routine',
		schema: SCHEMA,
		max_completion_tokens: MAX_TOKENS
	});

	const written = read(answer);
	if (!written.days.length) {
		throw new Error('No encontré una rutina en lo que describiste. Di qué ejercicios lleva, o para qué es.');
	}
	return written;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

/** A whole number from `min` to `max`, written as a number or as text; `fallback` when there is none. */
function count(value: unknown, min: number, max: number, fallback: number): number {
	const number = typeof value === 'string' && value.trim() ? Number(value) : value;
	if (typeof number !== 'number' || !Number.isFinite(number)) return fallback;
	return Math.min(max, Math.max(min, Math.round(number)));
}

/**
 * The routine in the model's answer. Out of strict mode it may not keep to the schema: what is out
 * of bounds is brought within them and what is missing takes the defaults, since the editor that
 * comes next is where anything wrong is put right. Only a day with no exercises is left out.
 */
function read(answer: unknown): Written {
	const routine = isRecord(answer) ? answer : {};
	const days = (Array.isArray(routine.days) ? routine.days : []).filter(isRecord).map((day) => ({
		id: shortId(),
		name: text(day.name),
		exercises: (Array.isArray(day.exercises) ? day.exercises : []).filter(isRecord).flatMap(entryOf)
	}));

	return {
		name: text(routine.name),
		days: days
			.filter((day) => day.exercises.length)
			.map((day, index) => ({ ...day, name: day.name || `Día ${index + 1}` }))
	};
}

function entryOf(item: Record<string, unknown>): RutinaEntry[] {
	// Out of strict mode, a model may name the exercise where its id goes: it is looked for by that
	// name, and kept as one of the user's own when the catalog has nothing like it.
	const given = text(item.exercise);
	const catalog = exerciseOf(given) ?? exerciseOf(guess(given));
	const name = text(item.name) || (catalog ? '' : given);
	if (!catalog && !name) return [];

	const timed = typeof item.timed === 'boolean' ? item.timed : Boolean(catalog?.timed);
	const reps = count(item.reps, 1, LIMITS.reps, timed ? DEFAULTS.timedReps : DEFAULTS.reps);
	return [
		{
			id: shortId(),
			exercise: catalog?.id ?? '',
			// The catalog's own name needs no copy: it is shown when the entry has none.
			name: catalog && normalize(catalog.name) === normalize(name) ? '' : name,
			sets: count(item.sets, 1, LIMITS.sets, DEFAULTS.sets),
			reps,
			timed,
			// Against the clock, the set's timer is the set itself.
			work: timed ? reps : DEFAULTS.work,
			rest: count(item.rest_seconds, 0, LIMITS.seconds, DEFAULTS.rest),
			last: parseBlocks(text(item.last_block)) ?? [],
			media: ''
		}
	];
}
