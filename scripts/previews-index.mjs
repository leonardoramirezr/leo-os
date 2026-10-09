// Writes previews/index.html: the list of published previews, so they can be found
// without remembering a branch name. Each folder carries the preview.json that
// scripts/publish-pages.sh saved next to the built site.
//
//   node scripts/previews-index.mjs <previews-folder>
//
// When no preview is left, the folder itself goes away.
//
// Each preview links to its branch's pull request: in GitHub Actions the script asks GitHub for the
// repository's pull requests once, since a PR is often opened after the push that published its
// preview (the list is rewritten on every publish, of any branch). Without an answer, the link is a
// search for the branch's pull requests, which still lands there.
//
// The page has an icon of its own, scripts/previews-icon.svg: without one, the tab shows none and
// iOS saves it to the home screen with Leo OS's, from the root of the site.

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appleTouchIcon } from './icons.mjs';

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

const repo = process.env.GITHUB_REPOSITORY ?? '';

/** Head branch → its pull request: the open one if there is one, else the newest. */
async function pullRequests() {
	const found = new Map();
	if (!repo) return found;
	const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
	try {
		const response = await fetch(
			`https://api.github.com/repos/${repo}/pulls?state=all&sort=created&direction=desc&per_page=100`,
			{
				headers: {
					accept: 'application/vnd.github+json',
					...(token ? { authorization: `Bearer ${token}` } : {})
				},
				signal: AbortSignal.timeout(10_000)
			}
		);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		for (const pr of await response.json()) {
			// A fork's branch of the same name is not this repository's.
			if (pr.head?.repo?.full_name !== repo) continue;
			const known = found.get(pr.head.ref);
			if (!known || (known.state !== 'open' && pr.state === 'open')) {
				found.set(pr.head.ref, { number: pr.number, url: pr.html_url, state: pr.state });
			}
		}
	} catch (error) {
		console.warn(`▸ Could not read the pull requests (${error.message}): linking a search instead.`);
	}
	return found;
}

const prs = await pullRequests();

/** Where the branch's pull request is, and how the link reads. */
function prLink(branch) {
	const pr = prs.get(branch);
	if (pr) return { href: pr.url, label: `#${pr.number}` };
	if (!repo) return null;
	const query = encodeURIComponent(`is:pr head:${branch}`).replace(/%20/g, '+');
	return { href: `https://github.com/${repo}/pulls?q=${query}`, label: 'PR' };
}

const icon = readFileSync(new URL('./previews-icon.svg', import.meta.url), 'utf8');
writeFileSync(join(dir, 'icon.svg'), icon);
writeFileSync(join(dir, 'apple-touch-icon.png'), appleTouchIcon(icon));

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
		const pr = prLink(branch);
		return `			<li>
				<a class="preview" href="./${encodeURIComponent(slug)}/">
					<span class="branch">${escape(branch)}</span>
					${meta ? `<span class="meta">${escape(meta)}</span>` : ''}
				</a>
				${pr ? `<a class="pr" href="${escape(pr.href)}">${escape(pr.label)}</a>` : ''}
			</li>`;
	})
	.join('\n');

writeFileSync(
	join(dir, 'index.html'),
	`<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<link rel="icon" type="image/svg+xml" href="./icon.svg" />
		<!-- Safari ignores an SVG here: scripts/icons.mjs rasterizes the same one. -->
		<link rel="apple-touch-icon" href="./apple-touch-icon.png" />
		<title>Previews · Leo OS</title>
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

			li {
				display: flex;
				align-items: center;
			}

			li + li {
				border-top: 1px solid var(--border);
			}

			a {
				color: var(--link);
				text-decoration: none;
			}

			/* Stacked: a branch name is long and must not be cut off. */
			.preview {
				display: flex;
				flex: 1;
				min-width: 0;
				flex-direction: column;
				gap: 3px;
				padding: 14px 16px;
			}

			/* Its own tap target, beside the preview's rather than inside it. */
			.pr {
				flex: none;
				padding: 14px 16px 14px 8px;
				font-size: 15px;
				white-space: nowrap;
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
		<h1>Previews</h1>
		<p>One per branch with unpublished changes. Deleting the branch removes it.</p>
		<ul>
${items}
		</ul>
	</body>
</html>
`
);

console.log(`✔ previews/index.html with ${previews.length} preview(s)`);
