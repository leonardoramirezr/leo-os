import { DAY, MINUTE } from './schedule';

const decimal = new Intl.NumberFormat('es', { maximumFractionDigits: 1 });

/** A wait, as short as the answer buttons need it: «1 min», «6 min», «3 d», «1,5 meses». */
export function formatWait(ms: number): string {
	const minutes = Math.max(1, Math.round(ms / MINUTE));
	if (minutes < 60) return `${minutes} min`;

	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} h`;

	const days = Math.max(1, Math.round(ms / DAY));
	if (days < 30) return `${days} d`;

	// Anki's months and years: thirty days and 365, to one decimal.
	const months = Math.round(days / 3) / 10;
	if (months < 12) return `${decimal.format(months)} ${months === 1 ? 'mes' : 'meses'}`;

	const years = Math.round(days / 36.5) / 10;
	return `${decimal.format(years)} ${years === 1 ? 'año' : 'años'}`;
}

/** «1 tarjeta», «3 tarjetas». */
export function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}
