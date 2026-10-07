// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}

		/** Which screen is showing, kept in the history entry so that «back» walks through them. */
		interface PageState {
			/** The routine open, by id. None: the list of routines. */
			routine?: string;
			/** Editing that routine; with no routine open, writing a new one. */
			edit?: boolean;
			/** Pasting a routine as JSON. */
			import?: boolean;
			/** Describing a new routine in one's own words, typed or dictated, for a chat model to write. */
			describe?: boolean;
			/** The open routine's statistics. */
			stats?: boolean;
			/** The workout under way, or its summary once it is over. */
			workout?: boolean;
		}

		// interface Platform {}
	}
}

export {};
