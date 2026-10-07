import { local, setting } from '@leo-os/shared';
import { DEFAULT_MODEL, listModels } from './groq';

// Groq's key lives in the account, so a second device is already set up. It carries no app's prefix
// because it is not this app's: every app here that talks to Groq reads the same one.
export const apiKey = setting('groq:api-key', '');

/** The chat model that writes a routine described in words, and matches an imported one's exercises. */
export const model = setting('rutina:model', DEFAULT_MODEL);

/**
 * The models the key can use. It stays on the device, like the other apps': it is a copy of what
 * Groq's `/models` answers, which is asked for again wherever the model can be picked.
 */
export const models = local<string[]>('rutina:models', []);

/** Asks Groq again which models the key can use: it adds models and retires others. */
export async function refreshModels() {
	if (!apiKey.value) return;
	try {
		models.value = await listModels(apiKey.value);
	} catch {
		// The list known already stays. If something is wrong, using the model will say what.
	}
}
