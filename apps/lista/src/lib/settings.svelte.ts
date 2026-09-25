import { setting } from '@leo-os/shared';

// Groq's key lives in the account, the way WillChat keeps its OpenAI one: a second device is already
// set up. It is a key of its own because Groq does not take OpenAI's, and it carries no app's prefix
// because it is not this app's: any app here that talks to Groq reads the same one.
export const apiKey = setting('groq:api-key', '');
