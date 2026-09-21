import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	schema: './schema.ts',
	out: './migrations',
	// `authenticated` and `anonymous` are Neon's own roles: the policies name them, but they are
	// not ours to create or drop.
	entities: { roles: { provider: 'neon' } },
	dbCredentials: { url: process.env.DATABASE_URL ?? '' }
});
