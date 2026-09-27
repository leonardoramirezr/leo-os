// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}

		/** Which screen is showing, kept in the history entry so that «back» walks through them. */
		interface PageState {
			/** The deck open, by id. None: the list of decks. */
			deck?: string;
			/** Studying that deck. */
			study?: boolean;
		}

		// interface Platform {}
	}
}

export {};
