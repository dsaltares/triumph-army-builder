# 0036 — Start the public repo from one squashed commit

- **Status:** Accepted
- **Date:** 2026-09-29
- **Related:** #229, #246, #247, ADR [0035](0035-reference-data-ships-as-a-pack-from-a-private-repo.md)

## Context

Every commit in this repo carries reference data that cannot be published: the snapshot, the
curated constants, the rules quoted in `docs/`. Removing it from the tree does not remove it from
history, and the history is what gets published if this repo is made public.

Some of it can be dropped by path — `data/`, `lib/data/sub-factions.ts`. Much of it cannot:
`lib/domain/troop-types.ts`, `curated-costs.ts`, `docs/DOMAIN.md` and the tests mix open code with
restricted values in every revision, and cleaning each one means rewriting it by hand.

GitHub keeps more than git does. Every merged pull request keeps a `refs/pull/<n>/head` that cannot
be deleted and shows the diff on its page; a commit that nothing references stays reachable by its
SHA until GitHub collects it; and issues and pull request descriptions quote the rules too.

## Decision

This repo is renamed `triumph-army-builder-data` and stays private, with its history, issues and
pull requests intact. A new public repo, `triumph-army-builder`, starts from one commit holding the
tree as it is once nothing restricted is left in it, checked by the restricted-content check before
it is pushed. Development continues there, and this repo keeps only the data and its tooling.

The rename happens before the new repo is created, because creating a repo under the old name ends
GitHub's redirect from it.

## Alternatives considered

- **Rewrite this repo's history with `git filter-repo` and make it public.** The mixed files leave
  restricted values in old revisions unless each is rewritten by hand, and the pull request refs,
  their diffs and the issues publish them regardless.
- **Keep developing here and mirror a filtered tree to the public repo.** Every commit is a chance
  for the filter to miss something, and there are two places a change can land.

## Consequences

- The public history starts at the split. `git blame` and the reasoning behind a line before it
  live in the data repo, which only maintainers can read; the ADRs, which travel, carry the
  decisions.
- Issue and pull request numbers restart in the public repo, so a `#N` written before the split
  refers to the data repo. ADRs before this one keep their numbers as written.
- The data repo keeps the full audit trail of every snapshot and curation change.

## Revisit trigger

WGC grant permission to publish the data (#53), at which point the history has nothing left to hide
and could be published as it is.
