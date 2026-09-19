// Writes previews/index.html: the list of published previews, so they can be found
// without remembering a branch name. Each folder carries the preview.json that
// scripts/publish-pages.sh saved next to the built site.
//
//   node scripts/previews-index.mjs <previews-folder>
//
// When no preview is left, the folder itself goes away.

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
	console.error('✖ Missing the previews folder.');
	process.exit(1);
}

/** What the publish left behind. An older preview may lack it: its folder is enough. */
function readMeta(slug) {
	try {
		const raw = JSON.parse(readFileSync(join(dir, slug, 'preview.json'), 'utf8'));
		return {
			branch: typeof raw.branch === 'string' && raw.branch ? raw.branch : slug,
			sha: typeof raw.sha === 'string' ? raw.sha : '',
			updated: typeof raw.updated === 'string' ? raw.updated : ''
		};
	} catch {
		return { branch: slug, sha: '', updated: '' };
	}
}

const previews = existsSync(dir)
	? readdirSync(dir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => ({ slug: entry.name, ...readMeta(entry.name) }))
			// Newest first; with no date, by name.
			.sort((a, b) => b.updated.localeCompare(a.updated) || a.slug.localeCompare(b.slug))
	: [];

if (previews.length === 0) {
	rmSync(dir, { recursive: true, force: true });
	console.log('✔ No previews left: removed previews/');
	process.exit(0);
}

const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escape = (text) => text.replace(/[&<>"]/g, (char) => entities[char]);

/** "2026-09-19T01:47:24Z" → "2026-09-19 01:47 UTC" */
function when(iso) {
	const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
	return match ? `${match[1]} ${match[2]} UTC` : '';
}

const items = previews
	.map(({ slug, branch, sha, updated }) => {
		const meta = [sha.slice(0, 7), when(updated)].filter(Boolean).join(' · ');
		return `			<li>
				<a href="./${encodeURIComponent(slug)}/">
					<span class="branch">${escape(branch)}</span>
					${meta ? `<span class="meta">${escape(meta)}</span>` : ''}
				</a>
			</li>`;
	})
	.join('\n');

writeFileSync(
	join(dir, 'index.html'),
	`<!doctype html>
<html lang="es">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Vistas previas · Leo OS</title>
		<style>
			:root {
				color-scheme: light dark;
				--bg: #f2f2f7;
				--text: #0d0d0d;
				--muted: #6b6b76;
				--group: #ffffff;
				--border: #e3e3e6;
				--link: #0a84ff;
			}

			@media (prefers-color-scheme: dark) {
				:root {
					--bg: #1c1c1e;
					--text: #ececec;
					--muted: #a3a3ab;
					--group: #2c2c2e;
					--border: #3a3a3d;
				}
			}

			body {
				max-width: 560px;
				margin: 0 auto;
				padding: 32px 16px 48px;
				background: var(--bg);
				color: var(--text);
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
				-webkit-font-smoothing: antialiased;
			}

			h1 {
				margin: 0 4px 4px;
				font-size: 24px;
			}

			p {
				margin: 0 4px 24px;
				color: var(--muted);
				font-size: 15px;
			}

			ul {
				margin: 0;
				padding: 0;
				overflow: hidden;
				border-radius: 12px;
				background: var(--group);
				list-style: none;
			}

			li + li {
				border-top: 1px solid var(--border);
			}

			/* Apilados: el nombre de una rama es largo y no se debe cortar. */
			a {
				display: flex;
				flex-direction: column;
				gap: 3px;
				padding: 14px 16px;
				color: var(--link);
				text-decoration: none;
			}

			.branch {
				overflow-wrap: anywhere;
			}

			.meta {
				color: var(--muted);
				font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
				font-size: 12px;
			}
		</style>
	</head>
	<body>
		<h1>Vistas previas</h1>
		<p>Una por rama con cambios sin publicar. Se borra al eliminar la rama.</p>
		<ul>
${items}
		</ul>
	</body>
</html>
`
);

console.log(`✔ previews/index.html with ${previews.length} preview(s)`);
