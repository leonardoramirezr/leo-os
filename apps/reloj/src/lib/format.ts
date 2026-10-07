// Times as the display shows them and as the voice says them.

/** «00:05:09.87»: hours, minutes, seconds and hundredths, from a whole number of hundredths. */
export function readout(hundredths: number): string {
	const whole = Math.max(0, Math.floor(hundredths));
	const pad = (value: number) => String(value).padStart(2, '0');
	const seconds = Math.floor(whole / 100);
	return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}.${pad(whole % 100)}`;
}

/** Where the hundredths start in a readout: from there on they are drawn smaller. */
export const HUNDREDTHS = 8;

/** «una hora», «21 horas»: hours is feminine, and Spanish says «una», not «uno», before it. */
function hours(count: number): string {
	if (count === 1) return 'una hora';
	if (count === 21) return 'veintiuna horas';
	return `${count} horas`;
}

/**
 * «un minuto», «veintiún minutos»: spelled out where the voice would say «uno» before the noun, which
 * reads «21 minutos» as «veintiuno minutos».
 */
function minutes(count: number): string {
	const tens = ['', '', 'veintiún', 'treinta y un', 'cuarenta y un', 'cincuenta y un'];
	if (count === 1) return 'un minuto';
	if (count % 10 === 1 && count > 20) return `${tens[Math.floor(count / 10)]} minutos`;
	return `${count} minutos`;
}

/** «una hora y 5 minutos», out of a whole number of minutes. */
function span(total: number): string {
	const parts: string[] = [];
	if (total >= 60) parts.push(hours(Math.floor(total / 60)));
	if (total % 60) parts.push(minutes(total % 60));
	return parts.join(' y ');
}

/** «Llevas 10 minutos»: what the stopwatch has run, said on the minute. */
export function spokenRun(total: number): string {
	return `Llevas ${span(total)}`;
}

/** «Quedan 10 minutos», «Queda un minuto»: what the timer has left, said on the minute. */
export function spokenLeft(total: number): string {
	// The verb goes with what is said first: the hours, if there are any.
	const one = total < 60 ? total === 1 : total < 120;
	return `${one ? 'Queda' : 'Quedan'} ${span(total)}`;
}

/** «Son las 3 y cuarto de la tarde», «Es la una en punto»: the time, as it is said in Mexico. */
export function spokenTime(date: Date): string {
	const hour = date.getHours();
	const minute = date.getMinutes();
	const twelve = hour % 12 || 12;

	const head = twelve === 1 ? 'Es la una' : `Son las ${twelve}`;
	const past =
		minute === 0 ? 'en punto' : minute === 15 ? 'y cuarto' : minute === 30 ? 'y media' : `y ${minute}`;
	const part =
		hour === 0
			? 'de la noche'
			: hour < 6
				? 'de la madrugada'
				: hour < 12
					? 'de la mañana'
					: hour < 13
						? 'del mediodía'
						: hour < 20
							? 'de la tarde'
							: 'de la noche';
	return `${head} ${past} ${part}`;
}

/** Whether the device writes the time with a.m. and p.m.: the clock shows it the way the phone does. */
export const twelveHour =
	new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false;

/** «3:05:09» or «15:05:09»; a blank first digit, faint as on a display, keeps the width. */
export function timeOfDay(date: Date): string {
	const hour = twelveHour ? date.getHours() % 12 || 12 : date.getHours();
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${String(hour).padStart(2, twelveHour ? ' ' : '0')}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const dayFormat = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

/** «martes, 7 de octubre». */
export function day(date: Date): string {
	return dayFormat.format(date);
}
