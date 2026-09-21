import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Only `svelte-check` reads this: each app compiles these files with its own Vite config, which
// turns runes on the same way.
export default { preprocess: vitePreprocess(), compilerOptions: { runes: true } };
