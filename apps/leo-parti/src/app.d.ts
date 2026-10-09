// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}

		/** Which screen is showing, kept in the history entry so that «back» walks through them. */
		interface PageState {
			/** A post of the account's own, open over its grid, by its code. */
			post?: string;
			/** Writing a new post. */
			composing?: boolean;
		}

		// interface Platform {}
	}
}

export {};
