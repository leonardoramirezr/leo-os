import { local, setting } from '@leo-os/shared';

// What WillChat is told to do lives in the account, so a second device is already set up. It keeps
// the prefixed keys it had when all of this was in localStorage.
export const apiKey = setting('willchat:api-key', '');
export const textModel = setting('willchat:text-model', 'gpt-5');
export const imageModel = setting('willchat:image-model', 'gpt-image-2.5-sunburst');

// Dictation goes through Groq, whose key is not WillChat's: every app here that talks to Groq reads
// this same one, so a key entered in Lista already works here, and the other way round.
export const groqKey = setting('groq:api-key', '');

/**
 * Model IDs available to the API key, newest first. This one stays on the device: it is a copy of
 * what `/v1/models` answers, which is asked for again whenever the key changes.
 */
export const availableModels = local<string[]>('willchat:models', []);
