// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}

		/** Which screen is showing, kept in the history entry so that «back» walks through them. */
		interface PageState {
			/** Looking at the program running. None: the list of programs, which a reload lands on. */
			run?: boolean;
		}

		// interface Platform {}
	}
}

export {};
