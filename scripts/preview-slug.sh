#!/usr/bin/env bash
#
# Prints the folder a branch gets inside previews/. That folder name is part of the
# URL, so it follows the same rule as the folders in apps/: lowercase, digits and
# dashes only.
#
#   preview-slug.sh claude/wizardly-euler → claude-wizardly-euler
#
# Prints nothing when no usable character is left; the caller decides what to do.

set -euo pipefail

printf '%s' "${1:?missing branch name}" |
	tr '[:upper:]' '[:lower:]' |
	sed -E 's/[^a-z0-9]+/-/g' |
	cut -c1-60 |
	sed -E 's/^-+//; s/-+$//'
