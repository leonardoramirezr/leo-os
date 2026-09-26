import { local, setting } from '@leo-os/shared';
import type { Language } from './generate';
import { DEFAULT_MODEL } from './groq';

// Groq's key lives in the account, so a second device is already set up. It carries no app's prefix
// because it is not this app's: every app here that talks to Groq reads the same one.
export const apiKey = setting('groq:api-key', '');

/** The model that writes cards, picked where they are generated. */
export const model = setting('repaso:model', DEFAULT_MODEL);

/** What generated cards are written in, picked next to the model. */
export const language = setting<Language>('repaso:language', 'es');

/**
 * The chat models the key can use. It stays on the device, like WillChat's: it is a copy of what
 * Groq's `/models` answers, which is asked for again every time cards are generated.
 */
export const models = local<string[]>('repaso:models', []);
