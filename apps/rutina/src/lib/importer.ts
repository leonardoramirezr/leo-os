// A routine pasted as JSON. The shape is a JSON Schema the import screen shows and copies, meant
// to be handed to a chat model together with a routine kept elsewhere — a note, a spreadsheet — so
// that it writes the JSON. The exercises come by name, never by the catalog's ids: a chat model on
// Groq matches each one to the catalog, and the user checks the matches before anything is saved.
import type { RutinaBlock, RutinaDay } from '@leo-os/shared';
import { CATALOG, exerciseOf, findByName, normalize } from './catalog';
import { parseBlocks } from './effort';
import { complete, GroqError, type ChatRequest } from './groq';
import { shortId } from './ids';
import { DEFAULTS, LIMITS } from './routine';

/** The shape of a routine as JSON, with what each key is for: what the import screen shows and copies. */
export const SCHEMA = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	title: 'Rutina',
	description:
		'Una rutina de ejercicios para la app Rutina, organizada por días. Los ejercicios van por su ' +
		'nombre: la app busca cada uno en su base de ejercicios, que trae su animación.',
	type: 'object',
	required: ['name', 'days'],
	additionalProperties: false,
	properties: {
		name: {
			type: 'string',
			description: 'El nombre de la rutina, p. ej. «Full body 5 días».'
		},
		days: {
			type: 'array',
			minItems: 1,
			description:
				'Los días de la rutina, en orden. Un día que se llama como un día de la semana (Lunes, ' +
				'Martes…) es el que la app propone ese día de la semana.',
			items: {
				type: 'object',
				required: ['name', 'exercises'],
				additionalProperties: false,
				properties: {
					name: {
						type: 'string',
						description: 'El nombre del día, p. ej. «Lunes» o «Día 1».'
					},
					exercises: {
						type: 'array',
						minItems: 1,
						description:
							'Los ejercicios del día, en el orden en que se hacen. Cada ronda hace una serie de ' +
							'cada ejercicio, y el que ya completó sus series deja de aparecer.',
						items: {
							type: 'object',
							required: ['exercise', 'sets', 'reps'],
							additionalProperties: false,
							properties: {
								exercise: {
									type: 'string',
									description:
										'El nombre del ejercicio, como se le conozca, p. ej. «Sentadilla goblet» o ' +
										'«Chin-up». No lleva ningún id: la app busca a qué ejercicio de su base ' +
										'corresponde, y el nombre escrito aquí es el que se muestra.'
								},
								sets: {
									type: 'integer',
									minimum: 1,
									maximum: LIMITS.sets,
									description: 'El número de series.'
								},
								reps: {
									type: 'integer',
									minimum: 1,
									description:
										'Las repeticiones de cada serie; si el ejercicio se hace por tiempo (una ' +
										'plancha), los segundos que dura cada serie. Con un rango, como 8–12, el ' +
										'número de abajo.'
								},
								timed: {
									type: 'boolean',
									description:
										'true si «reps» son segundos y no repeticiones. Si no se pone, lo decide el ' +
										'ejercicio de la base.'
								},
								rest_seconds: {
									type: 'integer',
									minimum: 0,
									description: `El descanso después de cada serie, en segundos. Si no se pone, ${DEFAULTS.rest}.`
								},
								set_seconds: {
									type: 'integer',
									minimum: 0,
									description:
										'El temporizador de cada serie, en segundos: al llegar a 0 suena una alarma. ' +
										`0 lo quita. Si no se pone, ${DEFAULTS.work}; en un ejercicio por tiempo, ` +
										'los segundos de la serie.'
								},
								last_block: {
									type: 'string',
									description:
										'Opcional: el último bloque de trabajo hecho fuera de la app, como ' +
										'«repeticiones@peso». «15@72kg» es una serie de 15 repeticiones con 72 kg; ' +
										'«15,15,12@72kg», tres series con 72 kg; «12», doce repeticiones sin peso. ' +
										'Es el esfuerzo que la app espera la primera vez.'
								},
								media: {
									type: 'string',
									description:
										'Opcional: la dirección de un GIF o un video (MP4) propio del ejercicio, que ' +
										'se muestra en lugar de la animación de la app.'
								}
							}
						}
					}
				}
			}
		}
	},
	examples: [
		{
			name: 'Full body 3 días',
			days: [
				{
					name: 'Lunes',
					exercises: [
						{ exercise: 'Sentadilla goblet', sets: 3, reps: 12, rest_seconds: 90, last_block: '12@24kg' },
						{ exercise: 'Chin-up', sets: 3, reps: 6 },
						{ exercise: 'Plancha', sets: 3, reps: 45, timed: true, rest_seconds: 60 }
					]
				}
			]
		}
	]
};

export const SCHEMA_TEXT = JSON.stringify(SCHEMA, null, 2);

/** An exercise as the JSON gave it, before it is matched to the catalog. */
export interface DraftExercise {
	name: string;
	sets: number;
	reps: number;
	/** `undefined` when the JSON leaves it to the catalog's exercise. */
	timed?: boolean;
	rest: number;
	/** `undefined` when the JSON leaves it to the default. */
	work?: number;
	last: RutinaBlock[];
	media: string;
}

export interface Draft {
	name: string;
	days: { name: string; exercises: DraftExercise[] }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A whole number, written as a number or as text: chat models do both. */
function integer(value: unknown): number | undefined {
	const number = typeof value === 'string' && value.trim() ? Number(value) : value;
	return typeof number === 'number' && Number.isInteger(number) ? number : undefined;
}

/**
 * Takes the JSON out of whatever came with it: a chat model's answer may wrap it in a code block,
 * or a sentence before and after.
 */
function extract(text: string): string {
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

/**
 * Reads a pasted routine. Gives back the routine, or every problem found — each one saying where —
 * so that they can all be fixed in one go.
 */
export function readDraft(text: string): { draft?: Draft; errors: string[] } {
	if (!text.trim()) return { errors: ['Pega el JSON de la rutina.'] };

	let raw: unknown;
	try {
		raw = JSON.parse(extract(text));
	} catch (error) {
		const reason = error instanceof Error ? error.message : '';
		return { errors: [`No es un JSON válido${reason ? `: ${reason}` : '.'}`] };
	}
	if (!isRecord(raw)) return { errors: ['El JSON tiene que ser un objeto, con «name» y «days».'] };

	const errors: string[] = [];
	const name = typeof raw.name === 'string' ? raw.name.trim() : '';
	if (!name) errors.push('Falta «name», el nombre de la rutina.');

	if (!Array.isArray(raw.days) || !raw.days.length) {
		errors.push('Falta «days», la lista de días, con al menos uno.');
		return { errors };
	}

	const days = raw.days.map((day, d) => {
		const where = `Día ${d + 1}`;
		if (!isRecord(day)) {
			errors.push(`${where}: tiene que ser un objeto con «name» y «exercises».`);
			return { name: '', exercises: [] };
		}

		const dayName = typeof day.name === 'string' ? day.name.trim() : '';
		const label = dayName ? `${where} («${dayName}»)` : where;
		if (!dayName) errors.push(`${where}: falta «name», el nombre del día.`);
		if (!Array.isArray(day.exercises) || !day.exercises.length) {
			errors.push(`${label}: falta «exercises», con al menos un ejercicio.`);
			return { name: dayName, exercises: [] };
		}

		const exercises = day.exercises.flatMap((item, e): DraftExercise[] => {
			const at = `${label}, ejercicio ${e + 1}`;
			if (!isRecord(item)) {
				errors.push(`${at}: tiene que ser un objeto con «exercise», «sets» y «reps».`);
				return [];
			}

			const exercise = typeof item.exercise === 'string' ? item.exercise.trim() : '';
			const here = exercise ? `${label}, «${exercise}»` : at;
			if (!exercise) errors.push(`${at}: falta «exercise», el nombre del ejercicio.`);

			const sets = integer(item.sets);
			if (sets === undefined || sets < 1 || sets > LIMITS.sets) {
				errors.push(`${here}: «sets» tiene que ser un número entero de 1 a ${LIMITS.sets}.`);
			}
			const reps = integer(item.reps);
			if (reps === undefined || reps < 1 || reps > LIMITS.reps) {
				errors.push(`${here}: «reps» tiene que ser un número entero mayor que 0.`);
			}

			const seconds = (key: string): number | undefined => {
				if (item[key] === undefined || item[key] === null) return undefined;
				const value = integer(item[key]);
				if (value === undefined || value < 0 || value > LIMITS.seconds) {
					errors.push(`${here}: «${key}» tiene que ser un número entero de segundos, de 0 a ${LIMITS.seconds}.`);
				}
				return value;
			};
			const rest = seconds('rest_seconds');
			const work = seconds('set_seconds');

			if (item.timed !== undefined && typeof item.timed !== 'boolean') {
				errors.push(`${here}: «timed» tiene que ser true o false.`);
			}

			let last: RutinaBlock[] = [];
			const written = item.last_block;
			if (written !== undefined && written !== null && written !== '') {
				const parsed =
					typeof written === 'string' || typeof written === 'number' ? parseBlocks(String(written)) : undefined;
				if (parsed) last = parsed;
				else errors.push(`${here}: «last_block» no se entiende; se escribe como «15@72kg».`);
			}

			if (item.media !== undefined && typeof item.media !== 'string') {
				errors.push(`${here}: «media» tiene que ser una dirección (texto).`);
			}

			return [
				{
					name: exercise,
					sets: sets ?? DEFAULTS.sets,
					reps: reps ?? DEFAULTS.reps,
					timed: typeof item.timed === 'boolean' ? item.timed : undefined,
					rest: rest ?? DEFAULTS.rest,
					work,
					last,
					media: typeof item.media === 'string' ? item.media.trim() : ''
				}
			];
		});

		return { name: dayName, exercises };
	});

	return errors.length ? { errors } : { draft: { name, days }, errors };
}

/** Every exercise name in the routine, once each, in the order they first appear. */
export function namesIn(draft: Draft): string[] {
	const seen = new Map<string, string>();
	for (const day of draft.days) {
		for (const exercise of day.exercises) {
			const key = normalize(exercise.name);
			if (!seen.has(key)) seen.set(key, exercise.name);
		}
	}
	return [...seen.values()];
}

/** Words that say nothing about which exercise it is. */
const FILLER = new Set(['con', 'de', 'del', 'la', 'el', 'las', 'los', 'en', 'a', 'al', 'y', 'o', 'the', 'with', 'of']);

function words(text: string): Set<string> {
	return new Set(normalize(text).split(' ').filter((word) => word && !FILLER.has(word)));
}

/**
 * The catalog's exercise a name most likely is, without a chat model: its name or an alias exactly,
 * else the one sharing the most words with it — counted both ways, so that «Pull-ups (dominadas
 * pronas)» is «Dominadas pronas» while «Saltos al cajón» is not «Saltos de tijera». What the
 * import falls back on when Groq cannot be asked, or leaves a name out.
 */
export function guess(name: string): string {
	const exact = findByName(name);
	if (exact) return exact.id;

	const wanted = words(name);
	let best = { id: '', score: 0 };
	for (const exercise of CATALOG) {
		for (const candidate of [exercise.name, ...exercise.aliases]) {
			const have = words(candidate);
			const shared = [...wanted].filter((word) => have.has(word)).length;
			const score = (2 * shared) / (wanted.size + have.size || 1);
			if (score > best.score) best = { id: exercise.id, score };
		}
	}
	return best.score > 0.5 ? best.id : '';
}

const INSTRUCTIONS = [
	"You match the exercises of a workout routine to the exercises of an app's catalog.",
	'',
	'You get the catalog, one exercise per line as "id: name (other names)", and a list of exercise',
	'names as someone wrote them, in Spanish or English, sometimes with details such as tempo,',
	'grip, equipment or notes in parentheses.',
	'',
	'For each name, answer with the id of the catalog exercise it is: the same movement, even if',
	'the name adds a tempo, a grip, a weight or a note. When the catalog has no exercise that is',
	'the same movement, answer with an empty id rather than a different exercise.',
	'',
	'Answer with a JSON object and nothing else, shaped',
	'{"matches": [{"name": "<the name, as given>", "exercise": "<catalog id or empty>"}]},',
	'with one match per name, in the order the names were given.'
].join('\n');

const SCHEMA_FOR_MATCHES = {
	type: 'object',
	properties: {
		matches: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					exercise: { type: 'string', enum: ['', ...CATALOG.map((exercise) => exercise.id)] }
				},
				required: ['name', 'exercise'],
				additionalProperties: false
			}
		}
	},
	required: ['matches'],
	additionalProperties: false
};

/** Room for the matches plus the reasoning of models that think before answering. */
const MAX_TOKENS = 8192;

/** Models that turned strict mode down during this visit: they get a plain JSON object straight away. */
const withoutSchema = new Set<string>();

function catalogText(): string {
	return CATALOG.map((exercise) => {
		const aliases = exercise.aliases.length ? ` (${exercise.aliases.join(', ')})` : '';
		return `${exercise.id}: ${exercise.name}${aliases}`;
	}).join('\n');
}

/**
 * Asks Groq which catalog exercise each name is. Gives back, for each name in `names`, the catalog
 * id or '' for none. A name the model leaves out, or answers with an id the catalog does not
 * have, falls back on `guess`.
 */
export async function matchWithGroq(apiKey: string, model: string, names: string[]): Promise<string[]> {
	const messages: ChatRequest['messages'] = [
		{ role: 'system', content: INSTRUCTIONS },
		{
			role: 'user',
			content: ['Catalog:', catalogText(), '', 'Names:', ...names.map((name) => `- ${name}`)].join('\n')
		}
	];

	let content: string | undefined;
	if (!withoutSchema.has(model)) {
		try {
			content = await complete(apiKey, {
				model,
				messages,
				response_format: {
					type: 'json_schema',
					json_schema: { name: 'exercise_matches', strict: true, schema: SCHEMA_FOR_MATCHES }
				},
				max_completion_tokens: MAX_TOKENS
			});
		} catch (error) {
			// «This model does not support response format `json_schema`»: which models do changes as
			// Groq adds and retires them.
			const refused =
				error instanceof GroqError && error.status === 400 && /json_schema|response.format/i.test(error.message);
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

	return readMatches(content, names);
}

function readMatches(content: string, names: string[]): string[] {
	// Outside strict mode a model may think out loud first, or wrap the object in a sentence.
	const text = content.replace(/<think>[\s\S]*?<\/think>/g, '');
	let answer: unknown;
	try {
		answer = JSON.parse(extract(text));
	} catch {
		throw new Error('No se entendió la respuesta de Groq.');
	}

	const list = isRecord(answer) && Array.isArray(answer.matches) ? answer.matches : [];
	const byName = new Map<string, string>();
	const inOrder: (string | undefined)[] = [];
	for (const item of list) {
		const name = isRecord(item) && typeof item.name === 'string' ? item.name : '';
		const id = isRecord(item) && typeof item.exercise === 'string' ? item.exercise : undefined;
		const known = id === '' || (id !== undefined && exerciseOf(id)) ? id : undefined;
		inOrder.push(known);
		if (name && known !== undefined) byName.set(normalize(name), known);
	}

	// By the name it was asked with, else by its place in the list, else by guessing.
	return names.map((name, index) => byName.get(normalize(name)) ?? inOrder[index] ?? guess(name));
}

/** The routine the draft makes, with each exercise matched to the catalog's (`''`, none). */
export function daysFrom(draft: Draft, matches: Map<string, string>): RutinaDay[] {
	return draft.days.map((day) => ({
		id: shortId(),
		name: day.name,
		exercises: day.exercises.map((item) => {
			const exercise = matches.get(normalize(item.name)) ?? '';
			const catalog = exerciseOf(exercise);
			const timed = item.timed ?? Boolean(catalog?.timed);
			return {
				id: shortId(),
				exercise,
				// The catalog's own name needs no copy: it is shown when the entry has none.
				name: catalog && normalize(catalog.name) === normalize(item.name) ? '' : item.name,
				sets: item.sets,
				reps: item.reps,
				timed,
				work: item.work ?? (timed ? item.reps : DEFAULTS.work),
				rest: item.rest,
				last: item.last,
				media: item.media
			};
		})
	}));
}
