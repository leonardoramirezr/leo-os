// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}

		/** Which screen is showing, kept in the history entry so that «back» walks through them. */
		interface PageState {
			/** The template being filled in, by id. None: the list of templates. */
			template?: string;
		}

		// interface Platform {}
	}
}

export {};
