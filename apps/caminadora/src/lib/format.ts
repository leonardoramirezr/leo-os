// Times and speeds, as the screens show them and as the voice says them.

/** «05:30», as the treadmill's display shows a time: minutes and seconds, the minutes past 59 too. */
export function clock(seconds: number): string {
	const whole = Math.max(0, Math.floor(seconds));
	const minutes = String(Math.floor(whole / 60)).padStart(2, '0');
	return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}

/** «32 min 30 s»: how long a program lasts, in the list. */
export function length(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const rest = seconds % 60;
	if (!minutes) return `${rest} s`;
	return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

/** «6.5», «10.0»: a speed with its one decimal, as the treadmill shows it. */
export function speed(value: number): string {
	return value.toFixed(1);
}

/**
 * «10», «6 punto 5»: a speed as the voice says it, without its unit. Spelled out rather than left to
 * the voice, which would read «6.5» the way its own country writes numbers.
 */
export function spokenSpeed(value: number): string {
	const tenths = Math.round(value * 10);
	const whole = Math.floor(tenths / 10);
	return tenths % 10 ? `${whole} punto ${tenths % 10}` : `${whole}`;
}

export function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}
