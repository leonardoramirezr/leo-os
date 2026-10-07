import { local, setting } from '@leo-os/shared';
import { DEFAULT_MODEL } from './groq';

// Groq's key lives in the account, so a second device is already set up. It carries no app's prefix
// because it is not this app's: every app here that talks to Groq reads the same one.
export const apiKey = setting('groq:api-key', '');

/** The chat model that matches an imported routine's exercises to the catalog. */
export const model = setting('rutina:model', DEFAULT_MODEL);

/**
 * The models the key can use. It stays on the device, like the other apps': it is a copy of what
 * Groq's `/models` answers, which is asked for again every time the settings open.
 */
export const models = local<string[]>('rutina:models', []);
