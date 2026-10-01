// Numbers and dates the way Instagram says them in Spanish.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** «1,234», with the separators of Mexican Spanish. */
export function count(value: number): string {
	return value.toLocaleString('es-MX');
}

/** Under a post: «hace 5 minutos», «hace 3 horas», «hace 2 días», then the date itself. */
export function postDate(at: number, now = Date.now()): string {
	const since = Math.max(0, now - at);
	if (since < MINUTE) return 'hace un momento';
	if (since < HOUR) return plural(Math.floor(since / MINUTE), 'minuto');
	if (since < DAY) return plural(Math.floor(since / HOUR), 'hora');
	if (since < WEEK) return plural(Math.floor(since / DAY), 'día');

	const date = new Date(at);
	const sameYear = date.getFullYear() === new Date(now).getFullYear();
	return date.toLocaleDateString('es-MX', {
		day: 'numeric',
		month: 'long',
		...(sameYear ? {} : { year: 'numeric' })
	});
}

function plural(value: number, unit: string): string {
	return `hace ${value} ${unit}${value === 1 ? '' : 's'}`;
}

/** Next to a comment, as short as Instagram has it: «ahora», «5 min», «3 h», «2 d», «4 sem». */
export function shortDate(at: number, now = Date.now()): string {
	const since = Math.max(0, now - at);
	if (since < MINUTE) return 'ahora';
	if (since < HOUR) return `${Math.floor(since / MINUTE)} min`;
	if (since < DAY) return `${Math.floor(since / HOUR)} h`;
	if (since < WEEK) return `${Math.floor(since / DAY)} d`;
	return `${Math.floor(since / WEEK)} sem`;
}

/** «1:05». */
export function clock(seconds: number): string {
	const whole = Math.max(0, Math.floor(seconds));
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
