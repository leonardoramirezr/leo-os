#!/usr/bin/env bash
#
# Publishes (or removes) a directory inside the `gh-pages` branch, which is what
# GitHub Pages serves:
#
#   publish-pages.sh site    <dist>          The published site, leaving previews/ alone
#   publish-pages.sh preview <slug> <dist>   A preview, at previews/<slug>/
#   publish-pages.sh remove  <slug>          Drops that preview
#
# Every branch of the repository publishes into this one branch, so two pushes at
# once can collide: the branch is read again and the push retried. Meant to run
# inside GitHub Actions, where `origin` already carries credentials.

set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
branch=${PAGES_BRANCH:-gh-pages}

mode=${1:?Usage: publish-pages.sh site <dist> | preview <slug> <dist> | remove <slug>}
slug=''
src=''

case $mode in
	site) src=${2:?missing build directory} ;;
	preview)
		slug=${2:?missing preview name}
		src=${3:?missing build directory}
		;;
	remove) slug=${2:?missing preview name} ;;
	*)
		echo "✖ Unknown mode: $mode" >&2
		exit 2
		;;
esac

# The preview name is pasted into a path: it must not escape previews/.
case $slug in
	*[!a-z0-9-]* | -* | *-)
		echo "✖ Invalid preview name: $slug" >&2
		exit 2
		;;
esac

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

# The very first time the branch does not exist: it opens with an empty-tree commit.
if ! git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
	echo "▸ Branch $branch does not exist yet: creating it empty."
	empty=$(git hash-object -t tree /dev/null)
	git push origin "$(git commit-tree "$empty" -m "Start $branch"):refs/heads/$branch"
fi

work=$(mktemp -d)/$branch

for attempt in 1 2 3 4 5; do
	git worktree remove --force "$work" 2>/dev/null || true
	git worktree prune
	git fetch --depth=1 --force origin "$branch"
	git worktree add --detach --quiet "$work" FETCH_HEAD

	case $mode in
		site)
			# The site is replaced whole; previews live apart and stay put.
			find "$work" -mindepth 1 -maxdepth 1 ! -name .git ! -name previews -exec rm -rf {} +
			cp -R "$src/." "$work/"
			;;
		preview)
			rm -rf "${work:?}/previews/$slug"
			mkdir -p "$work/previews/$slug"
			cp -R "$src/." "$work/previews/$slug/"
			;;
		remove) rm -rf "${work:?}/previews/$slug" ;;
	esac

	# Without this GitHub Pages runs the branch through Jekyll, which skips `_app/`.
	touch "$work/.nojekyll"
	node "$root/scripts/previews-index.mjs" "$work/previews"

	git -C "$work" add --all
	if git -C "$work" diff --cached --quiet; then
		echo "✔ Nothing to publish: $branch is already up to date."
		exit 0
	fi

	git -C "$work" commit --quiet --message "${PAGES_MESSAGE:-Publish ${slug:-the site}}"
	if git -C "$work" push --quiet origin "HEAD:refs/heads/$branch"; then
		echo "✔ Published to $branch."
		exit 0
	fi

	echo "▸ Another branch published first; retrying ($attempt of 5)." >&2
	sleep $((attempt * 3))
done

echo "✖ Could not publish to $branch after 5 attempts." >&2
exit 1
