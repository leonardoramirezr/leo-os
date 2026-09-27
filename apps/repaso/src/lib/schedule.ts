// When a card comes back, decided the way Anki's classic scheduler (SM-2) decides it, with Anki's
// default settings.
//
// A new card is learned in short steps — a minute, then ten — and graduates to a review a day later
// (four days with «Fácil»). From then on every «Bien» multiplies the interval by the card's ease,
// which starts at 2.5: «Difícil» lowers it and «Fácil» raises it. A card forgotten in a review drops
// its ease, is relearned in a ten-minute step and starts over at a day.

export type CardState = 'new' | 'learning' | 'review' | 'relearning';
export type Rating = 'again' | 'hard' | 'good' | 'easy';

export const ratings: Rating[] = ['again', 'hard', 'good', 'easy'];

/** Where a card stands. The columns of `repaso_cards` hold exactly this. */
export interface Schedule {
	state: CardState;
	/** The learning step it is on, while learning or relearning. */
	step: number;
	/** Epoch milliseconds: when it is shown again. Unused while new. */
	due: number;
	/** Days between reviews. While relearning, the interval it will come back with. */
	interval: number;
	/** Thousandths: 2500 multiplies the interval by 2.5 with each «Bien». */
	ease: number;
}

export const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Minutes between showings of a new card, until it graduates. */
const LEARNING_STEPS = [1, 10];
/** Minutes before a forgotten card is shown again. */
const RELEARNING_STEPS = [10];
/** Days to the first review of a card that graduates with «Bien», and with «Fácil». */
const GRADUATING_INTERVAL = 1;
const EASY_INTERVAL = 4;
export const START_EASE = 2500;
const MIN_EASE = 1300;
const HARD_FACTOR = 1.2;
const EASY_BONUS = 1.3;
const MAX_INTERVAL = 36_500;

/**
 * The day turns over at 4 a.m., as in Anki: studying past midnight still counts as the day before,
 * and a card due «tomorrow» is waiting first thing in the morning rather than at the hour of the day
 * it was answered.
 */
const DAY_STARTS_AT = 4;

/**
 * A card still being learned that comes due within this long is shown now rather than waited for,
 * once nothing else is left. That is what lets a session end with every card it touched learned.
 */
const LEARN_AHEAD = 20 * MINUTE;

/** The moment the day `now` belongs to began. */
export function dayStart(now: number): number {
	const date = new Date(now - DAY_STARTS_AT * HOUR);
	date.setHours(DAY_STARTS_AT, 0, 0, 0);
	return date.getTime();
}

/** The start of the day `days` after the one `now` belongs to. */
function daysLater(now: number, days: number): number {
	const date = new Date(dayStart(now));
	// Calendar days rather than 24-hour blocks, so a change to or from summer time keeps it at 4 a.m.
	date.setDate(date.getDate() + days);
	return date.getTime();
}

function clampInterval(days: number): number {
	return Math.min(MAX_INTERVAL, Math.max(1, Math.round(days)));
}

/** Whether the card is shown in a session started at `now`. New cards always are. */
export function isDue(card: Schedule, now: number): boolean {
	if (card.state === 'new') return true;
	if (card.state === 'review') return card.due <= now;
	return card.due <= now + LEARN_AHEAD;
}

/** Where the card stands after being answered with `rating` at `now`. */
export function answer(card: Schedule, rating: Rating, now: number): Schedule {
	return card.state === 'review' ? review(card, rating, now) : learn(card, rating, now);
}

/**
 * How long each answer puts the card away for, in milliseconds, which the buttons show. Once
 * learned it is whole days: the real wait also depends on the hour, which is noise on a button.
 */
export function wait(card: Schedule, rating: Rating, now: number): number {
	const next = answer(card, rating, now);
	return next.state === 'review' ? next.interval * DAY : next.due - now;
}

function learn(card: Schedule, rating: Rating, now: number): Schedule {
	const relearning = card.state === 'relearning';
	const state = relearning ? 'relearning' : 'learning';
	const steps = relearning ? RELEARNING_STEPS : LEARNING_STEPS;
	const step = card.state === 'new' ? 0 : Math.min(card.step, steps.length - 1);

	switch (rating) {
		case 'again':
			return { ...card, state, step: 0, due: now + steps[0] * MINUTE };
		case 'hard':
			return { ...card, state, step, due: now + hardDelay(steps, step) * MINUTE };
		case 'good':
			if (step + 1 < steps.length) {
				return { ...card, state, step: step + 1, due: now + steps[step + 1] * MINUTE };
			}
			return graduate(card, relearning ? card.interval : GRADUATING_INTERVAL, now);
		case 'easy':
			return graduate(card, relearning ? card.interval + 1 : EASY_INTERVAL, now);
	}
}

/** Anki's: on the first step, halfway to the next one; on the last, that same step again. */
function hardDelay(steps: number[], step: number): number {
	if (step > 0) return steps[step];
	return steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[0] * 1.5;
}

function graduate(card: Schedule, days: number, now: number): Schedule {
	const interval = clampInterval(days);
	return { ...card, state: 'review', step: 0, interval, due: daysLater(now, interval) };
}

function review(card: Schedule, rating: Rating, now: number): Schedule {
	if (rating === 'again') {
		return {
			...card,
			state: 'relearning',
			step: 0,
			// Relearned, it starts over at a day: Anki's «new interval» of 0 %.
			interval: GRADUATING_INTERVAL,
			ease: Math.max(MIN_EASE, card.ease - 200),
			due: now + RELEARNING_STEPS[0] * MINUTE
		};
	}

	// Remembered after a longer wait than planned says more than remembering on time: part of the
	// delay counts towards the next interval.
	const late = Math.max(0, Math.round((dayStart(now) - card.due) / DAY));
	const factor = card.ease / 1000;

	// Each answer puts the card away for at least a day longer than the one before it.
	const hard = clampInterval(Math.max(card.interval + 1, card.interval * HARD_FACTOR));
	const good = clampInterval(Math.max(hard + 1, (card.interval + late / 2) * factor));
	const easy = clampInterval(Math.max(good + 1, (card.interval + late) * factor * EASY_BONUS));

	switch (rating) {
		case 'hard':
			return reviewed(card, hard, Math.max(MIN_EASE, card.ease - 150), now);
		case 'good':
			return reviewed(card, good, card.ease, now);
		case 'easy':
			return reviewed(card, easy, card.ease + 150, now);
	}
}

function reviewed(card: Schedule, interval: number, ease: number, now: number): Schedule {
	return { ...card, state: 'review', step: 0, interval, ease, due: daysLater(now, interval) };
}
