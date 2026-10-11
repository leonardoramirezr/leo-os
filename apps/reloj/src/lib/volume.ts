// How loud the app is: where the slider sits, from 0 to 1, a preference of the account. The sound
// follows it in a straight line, from silence at the left end to three times the phone's own at the
// right: a third of the way along is the sound as it always was.
import { setting } from '@leo-os/shared';

/** How many times the app's own sound the right end of the slider plays. */
export const LOUDEST = 3;

export const volume = setting<number>('reloj:volume', 1 / LOUDEST);

/** What the sound is multiplied by: 0 to 3, 1 being as it always was. */
export function gain(): number {
	const value = volume.value;
	return typeof value === 'number' && Number.isFinite(value)
		? Math.min(1, Math.max(0, value)) * LOUDEST
		: 1;
}
