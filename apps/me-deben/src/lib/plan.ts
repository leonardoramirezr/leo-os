/**
 * Payment agreement: instead of a single due date, the loan is collected weekly or monthly
 * from the first charge date on, always on the same day of the week (or of the month).
 */

import { toDate, toIso } from './money';

/** How often it is collected. Empty is a loan without an agreement. */
export type Plan = '' | 'weekly' | 'monthly';

/** The two agreements that can be arranged, in the order they are offered. */
export const plans: { value: Plan; label: string; per: string }[] = [
	{ value: 'weekly', label: 'Por semana', per: 'por semana' },
	{ value: 'monthly', label: 'Por mes', per: 'por mes' }
];

/** Stored data may come from another version: only these two values are an agreement. */
export function isPlan(value: unknown): value is Plan {
	return value === 'weekly' || value === 'monthly';
}

/** "por semana" or "por mes", to build sentences with. Empty without an agreement. */
export function perLabel(plan: Plan): string {
	return plans.find((option) => option.value === plan)?.per ?? '';
}

function daysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

/**
 * The date of charge number `index` (the first one is 0). Adding months clamps the day to the
 * last of the month: an agreement starting on January 31 charges on February 28.
 */
export function chargeDate(start: string, plan: Plan, index: number): string {
	const first = toDate(start);
	if (plan === 'weekly') {
		return toIso(new Date(first.getFullYear(), first.getMonth(), first.getDate() + index * 7));
	}

	const month = new Date(first.getFullYear(), first.getMonth() + index, 1);
	const day = Math.min(first.getDate(), daysInMonth(month.getFullYear(), month.getMonth()));
	return toIso(new Date(month.getFullYear(), month.getMonth(), day));
}

/** How many charges fell before `on`. The charge of that same day is not due yet. */
export function chargesDueBefore(start: string, plan: Plan, on: string): number {
	if (plan === '' || start === '' || on <= start) return 0;

	const first = toDate(start);
	const until = toDate(on);

	if (plan === 'weekly') {
		// Under daylight saving a day lasts 23 or 25 hours: round to whole days.
		const days = Math.round((until.getTime() - first.getTime()) / 86_400_000);
		return Math.floor((days - 1) / 7) + 1;
	}

	const months =
		(until.getFullYear() - first.getFullYear()) * 12 + until.getMonth() - first.getMonth();
	const day = Math.min(first.getDate(), daysInMonth(until.getFullYear(), until.getMonth()));
	// This month's charge only counts once its day is behind us.
	return Math.max(0, until.getDate() <= day ? months : months + 1);
}

/** How many charges cover a loan. The last one is the remainder, so it can be smaller. */
export function chargeCount(amount: number, installment: number): number {
	return installment > 0 ? Math.ceil(amount / installment) : 0;
}
