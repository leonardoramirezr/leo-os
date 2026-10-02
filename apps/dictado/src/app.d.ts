// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}

		/** Which screen is showing, kept in the history entry so that «back» returns to the text. */
		interface PageState {
			/** Looking at what the model changed last. */
			changes?: boolean;
		}

		// interface Platform {}
	}
}

export {};
