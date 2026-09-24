import { setting } from '@leo-os/shared';

// Groq's key lives in the account, the way WillChat keeps its OpenAI one: a second device is already
// set up. It is a key of its own because Groq does not take OpenAI's.
export const apiKey = setting('lista:api-key', '');
