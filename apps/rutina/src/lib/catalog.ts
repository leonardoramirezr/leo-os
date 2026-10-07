// The exercises the app knows: what each is called, the group it trains, the names it also goes by
// and the animation that shows how it is done. A routine's exercise points at one by its id, which
// is stored in the database: a name can be reworded, an id never changes once published.
//
// The animations are ExerciseDB's free GIFs (oss.exercisedb.dev, no key needed): three-second
// loops of a 3D figure doing the exercise, the muscles it works in red, with no sound — the style
// of the GymVisual ones the routine this catalog started from linked to. They load from
// ExerciseDB's own CDN, and each one here was checked to be there and to show its exercise.

export type Group = 'warmup' | 'squat' | 'hinge' | 'hpush' | 'vpush' | 'vpull' | 'hpull' | 'core' | 'other';

/** The groups of the routine the catalog started from, in the order the picker lists them. */
export const GROUPS: { id: Group; name: string }[] = [
	{ id: 'warmup', name: 'Calentamiento' },
	{ id: 'squat', name: 'Sentadilla' },
	{ id: 'hinge', name: 'Bisagra de cadera' },
	{ id: 'hpush', name: 'Empuje horizontal' },
	{ id: 'vpush', name: 'Empuje vertical' },
	{ id: 'vpull', name: 'Jalón vertical' },
	{ id: 'hpull', name: 'Jalón horizontal' },
	{ id: 'core', name: 'Core' },
	{ id: 'other', name: 'Otros' }
];

export interface Exercise {
	id: string;
	name: string;
	group: Group;
	/** Other names it goes by, in Spanish and in English: what search and the import match against. */
	aliases: string[];
	/** Its GIF's id at ExerciseDB; '' when it has none. */
	gif: string;
	/** Done against the clock: a set is so many seconds rather than so many repetitions. */
	timed?: boolean;
}

export const CATALOG: Exercise[] = [
	// Calentamiento
	{
		id: 'jumping-jacks',
		name: 'Jumping jacks',
		group: 'warmup',
		aliases: ['jumping jack', 'saltos de tijera', 'saltos abriendo piernas', 'astride jumps'],
		gif: 'f9lVSSI',
		timed: true
	},
	{
		id: 'jumping-jacks-frontales',
		name: 'Jumping jacks frontales',
		group: 'warmup',
		aliases: [
			'jumping jacks front',
			'front jacks',
			'scissor jacks',
			'scissor jumps',
			'saltos de tijera adelante y atrás'
		],
		gif: 'Eh2v5Iu',
		timed: true
	},
	{
		id: 'circulos-hombro',
		name: 'Círculos de hombro',
		group: 'warmup',
		aliases: ['shoulder circles', 'shoulder rolls', 'rotación de hombros', 'arm circles', 'círculos de brazos'],
		gif: ''
	},
	{
		id: 'saltar-cuerda',
		name: 'Saltar la cuerda',
		group: 'warmup',
		aliases: ['jump rope', 'comba', 'cuerda'],
		gif: 'e1e76I2',
		timed: true
	},
	{ id: 'burpees', name: 'Burpees', group: 'warmup', aliases: ['burpee'], gif: 'dK9394r' },
	{
		id: 'escaladores',
		name: 'Escaladores',
		group: 'warmup',
		aliases: ['mountain climbers', 'mountain climber'],
		gif: 'RJgzwny',
		timed: true
	},

	// Sentadilla
	{
		id: 'sentadilla-goblet',
		name: 'Sentadilla goblet',
		group: 'squat',
		aliases: ['goblet squat', 'sentadilla copa', 'sentadilla goblet con tempo', 'sentadilla con mancuerna al pecho'],
		gif: 'yn8yg1r'
	},
	{
		id: 'sentadilla-barra',
		name: 'Sentadilla con barra',
		group: 'squat',
		aliases: ['back squat', 'barbell squat', 'sentadilla trasera', 'sentadilla libre'],
		gif: 'qXTaZnJ'
	},
	{
		id: 'sentadilla-frontal',
		name: 'Sentadilla frontal',
		group: 'squat',
		aliases: ['front squat', 'sentadilla frontal con barra'],
		gif: 'zG0zs85'
	},
	{
		id: 'sentadilla-mancuernas',
		name: 'Sentadilla con mancuernas',
		group: 'squat',
		aliases: ['dumbbell squat', 'sentadilla con mancuernas a los lados'],
		gif: 'HsvHqgf'
	},
	{
		id: 'sentadilla-peso-corporal',
		name: 'Sentadilla con peso corporal',
		group: 'squat',
		aliases: ['bodyweight squat', 'air squat', 'sentadilla sin peso'],
		gif: '75Bgtjy'
	},
	{
		id: 'sentadilla-bulgara',
		name: 'Sentadilla búlgara',
		group: 'squat',
		aliases: ['bulgarian split squat', 'desplante búlgaro', 'split squat'],
		gif: 'qx4fgX7'
	},
	{
		id: 'zancadas',
		name: 'Zancadas',
		group: 'squat',
		aliases: ['lunges', 'lunge', 'desplantes', 'estocadas', 'dumbbell lunge'],
		gif: 'RRWFUcw'
	},
	{
		id: 'prensa',
		name: 'Prensa de piernas',
		group: 'squat',
		aliases: ['leg press', 'prensa 45', 'press de pierna'],
		gif: '10Z2DXU'
	},
	{
		id: 'extension-cuadriceps',
		name: 'Extensión de cuádriceps',
		group: 'squat',
		aliases: ['leg extension', 'extensión de piernas', 'extensión de rodilla'],
		gif: 'my33uHU'
	},
	{
		id: 'step-up',
		name: 'Subida al cajón',
		group: 'squat',
		aliases: ['step-up', 'step up', 'subida al banco'],
		gif: 'aXtJhlg'
	},

	// Bisagra de cadera
	{
		id: 'peso-muerto',
		name: 'Peso muerto',
		group: 'hinge',
		aliases: ['deadlift', 'barbell deadlift', 'peso muerto convencional'],
		gif: 'ila4NZS'
	},
	{
		id: 'peso-muerto-hexagonal',
		name: 'Peso muerto con barra hexagonal',
		group: 'hinge',
		aliases: ['trap bar deadlift', 'hex bar deadlift', 'peso muerto barra hexagonal'],
		gif: 'jQGwmxN'
	},
	{
		id: 'peso-muerto-rumano',
		name: 'Peso muerto rumano',
		group: 'hinge',
		aliases: ['romanian deadlift', 'rdl', 'peso muerto rumano con barra'],
		gif: 'wQ2c4XD'
	},
	{
		id: 'peso-muerto-rumano-mancuernas',
		name: 'Peso muerto rumano con mancuernas',
		group: 'hinge',
		aliases: ['dumbbell romanian deadlift', 'rdl con mancuernas'],
		gif: 'rR0LJzx'
	},
	{ id: 'peso-muerto-sumo', name: 'Peso muerto sumo', group: 'hinge', aliases: ['sumo deadlift'], gif: 'KgI0tqW' },
	{
		id: 'hip-thrust',
		name: 'Hip thrust con barra',
		group: 'hinge',
		aliases: ['hip thrust', 'barbell glute bridge', 'puente de glúteo con barra', 'elevación pélvica con barra'],
		gif: 'qKBpF7I'
	},
	{
		id: 'puente-gluteo',
		name: 'Puente de glúteo',
		group: 'hinge',
		aliases: ['glute bridge', 'elevación pélvica', 'puente'],
		gif: 'u0cNiij'
	},
	{
		id: 'swing-kettlebell',
		name: 'Swing con kettlebell',
		group: 'hinge',
		aliases: ['kettlebell swing', 'swing con pesa rusa'],
		gif: 'UHJlbu3'
	},
	{
		id: 'buenos-dias',
		name: 'Buenos días',
		group: 'hinge',
		aliases: ['good morning', 'buenos días con barra'],
		gif: 'XlZ4lAC'
	},

	// Empuje horizontal
	{
		id: 'lagartijas',
		name: 'Lagartijas',
		group: 'hpush',
		aliases: ['push-ups', 'push-up', 'push ups', 'flexiones', 'flexiones de pecho', 'lagartijas con peso'],
		gif: 'I4hDWkc'
	},
	{
		id: 'press-banca',
		name: 'Press de banca',
		group: 'hpush',
		aliases: ['bench press', 'barbell bench press', 'press plano con barra', 'press de pecho'],
		gif: 'EIeI8Vf'
	},
	{
		id: 'press-banca-mancuernas',
		name: 'Press de banca con mancuernas',
		group: 'hpush',
		aliases: ['dumbbell bench press', 'press plano con mancuernas'],
		gif: 'SpYC0Kp'
	},
	{
		id: 'press-inclinado',
		name: 'Press inclinado con barra',
		group: 'hpush',
		aliases: ['incline bench press', 'press inclinado'],
		gif: '3TZduzM'
	},
	{
		id: 'press-inclinado-mancuernas',
		name: 'Press inclinado con mancuernas',
		group: 'hpush',
		aliases: ['incline dumbbell press'],
		gif: 'ns0SIbU'
	},
	{
		id: 'fondos',
		name: 'Fondos en paralelas',
		group: 'hpush',
		aliases: ['dips', 'chest dips', 'fondos'],
		gif: '9WTm7dq'
	},
	{
		id: 'aperturas',
		name: 'Aperturas con mancuernas',
		group: 'hpush',
		aliases: ['dumbbell fly', 'chest fly', 'aperturas'],
		gif: 'yz9nUhF'
	},

	// Empuje vertical
	{
		id: 'press-militar',
		name: 'Press militar con barra',
		group: 'vpush',
		aliases: [
			'overhead press',
			'military press',
			'barbell standing military press',
			'press militar',
			'press militar con barra agarre pronado',
			'press de hombro con barra'
		],
		gif: 'Kyd9Rz5'
	},
	{
		id: 'press-hombro-mancuernas',
		name: 'Press de hombro con mancuernas',
		group: 'vpush',
		aliases: ['dumbbell shoulder press', 'dumbbell overhead press', 'press militar con mancuernas'],
		gif: 'A6wtbuL'
	},
	{
		id: 'press-hombro-sentado',
		name: 'Press de hombro sentado',
		group: 'vpush',
		aliases: ['seated dumbbell shoulder press', 'press militar sentado con mancuernas'],
		gif: 'znQUdHY'
	},
	{ id: 'press-arnold', name: 'Press Arnold', group: 'vpush', aliases: ['arnold press'], gif: 'Xy4jlWA' },

	// Jalón vertical
	{
		id: 'dominadas-supinas',
		name: 'Dominadas supinas',
		group: 'vpull',
		aliases: [
			'chin-up',
			'chin-ups',
			'chin up',
			'dominadas supino',
			'dominadas con palmas hacia ti',
			'dominada cerrada'
		],
		gif: 'T2mxWqc'
	},
	{
		id: 'dominadas-pronas',
		name: 'Dominadas pronas',
		group: 'vpull',
		aliases: ['pull-up', 'pull-ups', 'pull up', 'dominadas', 'dominada abierta'],
		gif: 'lBDjFxJ'
	},
	{
		id: 'dominadas-neutras',
		name: 'Dominadas neutras',
		group: 'vpull',
		aliases: ['neutral grip pull-up', 'dominadas con agarre neutro'],
		gif: '0V2YQjW'
	},
	{
		id: 'jalon-pecho',
		name: 'Jalón al pecho',
		group: 'vpull',
		aliases: ['lat pulldown', 'jalón dorsal', 'polea al pecho'],
		gif: 'RVwzP10'
	},
	{
		id: 'jalon-supino',
		name: 'Jalón al pecho supino',
		group: 'vpull',
		aliases: ['underhand pulldown', 'reverse grip lat pulldown', 'jalón con agarre supino'],
		gif: 'xBYcQHj'
	},

	// Jalón horizontal
	{
		id: 'remo-barra',
		name: 'Remo inclinado con barra',
		group: 'hpull',
		aliases: ['barbell row', 'bent over row', 'remo con barra', 'remo inclinado con barra recta'],
		gif: 'eZyBC3j'
	},
	{
		id: 'remo-mancuerna',
		name: 'Remo con mancuerna a una mano',
		group: 'hpull',
		aliases: ['one arm dumbbell row', 'single-arm dumbbell row', 'remo unilateral'],
		gif: 'C0MA9bC'
	},
	{
		id: 'remo-mancuernas',
		name: 'Remo inclinado con mancuernas',
		group: 'hpull',
		aliases: ['dumbbell bent over row', 'remo con dos mancuernas'],
		gif: 'BJ0Hz5L'
	},
	{
		id: 'remo-polea',
		name: 'Remo sentado en polea',
		group: 'hpull',
		aliases: ['seated cable row', 'remo en polea baja'],
		gif: 'fUBheHs'
	},
	{
		id: 'remo-invertido',
		name: 'Remo invertido',
		group: 'hpull',
		aliases: ['inverted row', 'australian pull-up', 'remo australiano'],
		gif: 'bZGHsAZ'
	},
	{ id: 'face-pull', name: 'Face pull', group: 'hpull', aliases: ['face pulls', 'jalón a la cara'], gif: 'ZfyAGhK' },

	// Core
	{
		id: 'plancha',
		name: 'Plancha',
		group: 'core',
		aliases: ['plank', 'rkc plank', 'plancha rkc', 'front plank', 'plancha con peso'],
		gif: 'VBAWRPG',
		timed: true
	},
	{
		id: 'plancha-lateral',
		name: 'Plancha lateral',
		group: 'core',
		aliases: ['side plank'],
		gif: 'RKjH6Lt',
		timed: true
	},
	{
		id: 'hiperextensiones',
		name: 'Hiperextensiones',
		group: 'core',
		aliases: ['hyperextension', 'hyperextensions', 'back extension', 'extensión lumbar'],
		gif: 'zhMwOwE'
	},
	{
		id: 'silla-capitan',
		name: 'Elevación de piernas en silla capitán',
		group: 'core',
		aliases: [
			"captain's chair leg raise",
			'captains chair',
			'weighted captains chair',
			'silla romana',
			'elevación de piernas en paralelas'
		],
		gif: 'weoDEpH'
	},
	{
		id: 'silla-capitan-rodillas',
		name: 'Elevación de rodillas en silla capitán',
		group: 'core',
		aliases: ["captain's chair knee raise", 'vertical knee raise', 'elevación de rodillas en paralelas'],
		gif: 'ZNgOYQU'
	},
	{
		id: 'elevacion-piernas-colgado',
		name: 'Elevación de piernas colgado',
		group: 'core',
		aliases: ['hanging leg raise', 'hanging knee raise', 'elevación de rodillas colgado'],
		gif: 'I3tsCnC'
	},
	{
		id: 'elevacion-piernas',
		name: 'Elevación de piernas acostado',
		group: 'core',
		aliases: ['lying leg raise', 'leg raises'],
		gif: 'WhuFnR7'
	},
	{ id: 'crunch', name: 'Crunch', group: 'core', aliases: ['crunches', 'abdominales'], gif: 'TFqbd8t' },
	{ id: 'crunch-bicicleta', name: 'Crunch bicicleta', group: 'core', aliases: ['bicycle crunch'], gif: '1ZFqTDN' },
	{
		id: 'rueda-abdominal',
		name: 'Rueda abdominal',
		group: 'core',
		aliases: ['ab wheel rollout', 'ab wheel', 'roll out abdominal'],
		gif: 'NAgVB3t'
	},
	{ id: 'giro-ruso', name: 'Giro ruso', group: 'core', aliases: ['russian twist'], gif: 'XVDdcoj' },
	{ id: 'bicho-muerto', name: 'Bicho muerto', group: 'core', aliases: ['dead bug'], gif: 'iny3m5y' },

	// Otros
	{
		id: 'elevaciones-laterales',
		name: 'Elevaciones laterales',
		group: 'other',
		aliases: ['lateral raise', 'lateral raises', 'dumbbell lateral raise', 'elevación lateral'],
		gif: 'DsgkuIt'
	},
	{
		id: 'pajaros',
		name: 'Pájaros',
		group: 'other',
		aliases: ['reverse fly', 'rear delt fly', 'pájaros / reverse fly', 'aperturas invertidas', 'elevación posterior'],
		gif: 'v1qBec9'
	},
	{
		id: 'elevaciones-frontales',
		name: 'Elevaciones frontales',
		group: 'other',
		aliases: ['front raise', 'elevación frontal'],
		gif: '3eGE2JC'
	},
	{
		id: 'encogimientos',
		name: 'Encogimientos de hombros',
		group: 'other',
		aliases: ['shrugs', 'dumbbell shrug', 'encogimientos', 'elevación de trapecios'],
		gif: 'NJzBsGJ'
	},
	{
		id: 'curl-mancuernas',
		name: 'Curl de bíceps con mancuernas',
		group: 'other',
		aliases: ['dumbbell curl', 'biceps curl', 'curl de bíceps', 'flexión de codo'],
		gif: 'NbVPDMW'
	},
	{ id: 'curl-barra', name: 'Curl con barra', group: 'other', aliases: ['barbell curl'], gif: '25GPyDY' },
	{ id: 'curl-martillo', name: 'Curl martillo', group: 'other', aliases: ['hammer curl'], gif: '2NpxjC1' },
	{
		id: 'triceps-polea',
		name: 'Extensión de tríceps en polea',
		group: 'other',
		aliases: ['triceps pushdown', 'pushdown', 'jalón de tríceps'],
		gif: '3ZflifB'
	},
	{
		id: 'press-frances',
		name: 'Press francés',
		group: 'other',
		aliases: ['skull crusher', 'lying triceps extension', 'rompecráneos'],
		gif: 'h8LFzo9'
	},
	{
		id: 'triceps-sobre-cabeza',
		name: 'Extensión de tríceps sobre la cabeza',
		group: 'other',
		aliases: ['overhead triceps extension', 'extensión de codo copa'],
		gif: 'PdmaD0N'
	},
	{
		id: 'fondos-banco',
		name: 'Fondos en banco',
		group: 'other',
		aliases: ['bench dips', 'fondos de tríceps'],
		gif: 'VuoerH0'
	},
	{
		id: 'pantorrillas',
		name: 'Elevación de talones',
		group: 'other',
		aliases: ['calf raise', 'calf raises', 'pantorrillas', 'gemelos', 'elevación de pantorrillas'],
		gif: 'dPmaUaU'
	},
	{
		id: 'curl-femoral',
		name: 'Curl femoral',
		group: 'other',
		aliases: ['leg curl', 'lying leg curl', 'femoral acostado', 'flexión de rodilla'],
		gif: '17lJ1kr'
	},
	{
		id: 'paseo-granjero',
		name: 'Paseo del granjero',
		group: 'other',
		aliases: ['farmer walk', "farmer's walk", 'caminata del granjero'],
		gif: 'qPEzJjA',
		timed: true
	}
];

const byId = new Map(CATALOG.map((exercise) => [exercise.id, exercise]));

export function exerciseOf(id: string): Exercise | undefined {
	return byId.get(id);
}

export function groupOf(id: Group): string {
	return GROUPS.find((group) => group.id === id)?.name ?? '';
}

export function gifUrl(gif: string): string {
	return `https://static.exercisedb.dev/media/${gif}.gif`;
}

/** Case, accents and punctuation aside: «Pájaros / reverse fly» is «pajaros reverse fly». */
export function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

/** The catalog as a chat model is shown it: one exercise per line, «id: name (other names)». */
export function catalogText(): string {
	return CATALOG.map((exercise) => {
		const aliases = exercise.aliases.length ? ` (${exercise.aliases.join(', ')})` : '';
		return `${exercise.id}: ${exercise.name}${aliases}`;
	}).join('\n');
}

/** Every name an exercise answers to, normalized. */
function namesOf(exercise: Exercise): string[] {
	return [exercise.name, ...exercise.aliases].map(normalize);
}

/** The exercise whose name or alias is exactly this one, case and accents aside. */
export function findByName(name: string): Exercise | undefined {
	const wanted = normalize(name);
	return wanted ? CATALOG.find((exercise) => namesOf(exercise).includes(wanted)) : undefined;
}

/** The picker's search: every word typed has to start a word of the name or of an alias. */
export function search(query: string): Exercise[] {
	const words = normalize(query).split(' ').filter(Boolean);
	if (!words.length) return CATALOG;

	return CATALOG.filter((exercise) =>
		namesOf(exercise).some((name) => {
			const parts = name.split(' ');
			return words.every((word) => parts.some((part) => part.startsWith(word)));
		})
	);
}
