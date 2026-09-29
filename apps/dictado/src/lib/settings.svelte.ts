import { local, setting } from '@leo-os/shared';
import { DEFAULT_CHAT_MODEL, DEFAULT_TRANSCRIPTION_MODEL } from './groq';
import { DEFAULT_PROMPT } from './rewrite';

// Groq's key lives in the account, so a second device is already set up. It carries no app's prefix
// because it is not this app's: every app here that talks to Groq reads the same one.
export const apiKey = setting('groq:api-key', '');

/** What Whisper is told the dictation is in. Empty lets it work it out. */
export type Language = 'es' | 'en' | '';

/** Turns what was said into text. */
export const transcriptionModel = setting('dictado:transcription-model', DEFAULT_TRANSCRIPTION_MODEL);

export const language = setting<Language>('dictado:language', 'es');

/** Improves what was dictated, and carries out what «Editar» is told. */
export const chatModel = setting('dictado:model', DEFAULT_CHAT_MODEL);

/** The «Mejorar texto» switch. */
export const improving = setting('dictado:improve', false);

/** What «Mejorar texto» asks the chat model for, in the user's words. */
export const prompt = setting('dictado:prompt', DEFAULT_PROMPT);

/**
 * The models the key can use. It stays on the device, like Repaso's: it is a copy of what Groq's
 * `/models` answers, which is asked for again every time the settings open.
 */
export const models = local<string[]>('dictado:models', []);
