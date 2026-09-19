/**
 * Amounts are stored as whole cents: adding and subtracting pesos as floating point numbers
 * accumulates errors (0.1 + 0.2 ≠ 0.3), and every balance here is a sum of movements.
 */

const currency = new Intl.NumberFormat('es-MX', {
	style: 'currency',
	currency: 'MXN',
	minimumFractionDigits: 2
});

/** "$1,234.50" */
export function formatMoney(cents: number): string {
	return currency.format(cents / 100);
}

/** What the user typed into the amount field, in cents. `null` when it is not a valid amount. */
export function parseMoney(input: string): number | null {
	const cleaned = input.replace(/[\s,$]/g, '');
	if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return null;

	const cents = Math.round(Number(cleaned) * 100);
	return Number.isFinite(cents) && cents > 0 ? cents : null;
}

/** The amount in the format the text field expects: "1234.50". */
export function toAmountInput(cents: number): string {
	return (cents / 100).toFixed(2);
}

const longDate = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

/** Dates are stored as "YYYY-MM-DD" and read as local dates, not UTC. */
export function toDate(iso: string): Date {
	const [year, month, day] = iso.split('-').map(Number);
	return new Date(year, month - 1, day);
}

export function formatDate(iso: string): string {
	return longDate.format(toDate(iso));
}

/** Dates in the current year drop the year: "3 mar". */
export function formatDateShort(iso: string): string {
	const date = toDate(iso);
	if (date.getFullYear() !== new Date().getFullYear()) return longDate.format(date);
	return shortDate.format(date).replace('.', '');
}

/** A local date back to "YYYY-MM-DD". */
export function toIso(date: Date): string {
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

/** Today as "YYYY-MM-DD", in the browser's time zone. */
export function today(): string {
	return toIso(new Date());
}
