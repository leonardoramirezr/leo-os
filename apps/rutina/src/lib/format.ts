const numberFormat = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const compactFormat = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });
const shortDateFormat = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

export function plural(count: number, one: string, many: string): string {
	return `${numberFormat.format(count)} ${count === 1 ? one : many}`;
}

/** 12,340 — thousands with a comma, at most one decimal. */
export function formatNumber(value: number): string {
	return numberFormat.format(value);
}

/** 12.3 k: for axis ticks, where room is short. */
export function formatCompact(value: number): string {
	return compactFormat.format(value);
}

/** A timer: «1:30», «0:05»; past zero it counts up, «+0:12». */
export function formatClock(seconds: number): string {
	const over = seconds < 0;
	const whole = Math.abs(over ? Math.floor(seconds) : Math.ceil(seconds));
	const minutes = Math.floor(whole / 60);
	const rest = String(whole % 60).padStart(2, '0');
	return `${over ? '+' : ''}${minutes}:${rest}`;
}

/** A time span in words: «45 s», «12 min», «1 h 5 min». */
export function formatDuration(milliseconds: number): string {
	const seconds = Math.max(0, Math.round(milliseconds / 1000));
	if (seconds < 60) return `${seconds} s`;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

/** A timer field's value: «1:30», and «Sin» for none. */
export function formatTimer(seconds: number): string {
	return seconds > 0 ? formatClock(seconds) : 'Sin';
}

/** What was typed into a timer field, in seconds: «1:30», «90», «90 s», «2 min». */
export function parseSeconds(text: string): number | undefined {
	const clean = text.trim().toLowerCase();
	if (!clean || clean === 'sin') return 0;
	const clock = /^(\d+):(\d{1,2})$/.exec(clean);
	if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
	const minutes = /^(\d+(?:[.,]\d+)?)\s*m(?:in)?$/.exec(clean);
	if (minutes) return Math.round(Number(minutes[1].replace(',', '.')) * 60);
	const seconds = /^(\d+)\s*(?:s|seg)?$/.exec(clean);
	return seconds ? Number(seconds[1]) : undefined;
}

/** «7 oct» */
export function formatShortDate(epoch: number): string {
	return shortDateFormat.format(epoch);
}

function startOfDay(epoch: number): number {
	const date = new Date(epoch);
	date.setHours(0, 0, 0, 0);
	return date.getTime();
}

/** «hoy», «ayer», «hace 3 días», then the date: when a day was last trained. */
export function formatAgo(epoch: number, now = Date.now()): string {
	const days = Math.round((startOfDay(now) - startOfDay(epoch)) / 86_400_000);
	if (days <= 0) return 'hoy';
	if (days === 1) return 'ayer';
	if (days < 7) return `hace ${days} días`;
	return `el ${formatShortDate(epoch)}`;
}

export function sameDay(a: number, b: number): boolean {
	return startOfDay(a) === startOfDay(b);
}
