# Design

## Determinism first

This is the change that breaks "a board is reproducible from the repo alone", so it carries the mitigation with it rather than after it.

Two mechanisms, both required:

1. **Opt-in.** The cross-project rung applies only when the workspace asks for it. A workspace that says nothing prices exactly as it did before this change, so the default stays reproducible.
2. **Overridable root.** The store's location resolves from an environment variable before falling back to the user's config directory. Every e2e spec sets it to a temp directory, so no test can read or write a developer's real history — including the specs written before this change, which must be updated to set it unconditionally.

Task 2.1 lands the override and the test-wide isolation *before* any pricing reads the store. A suite that can reach the real home even once is a suite that passes on one machine and fails on another.

## Store shape

Runs keyed by Flow and Size Tier, appended by the recording command at the same time it writes the epic. The store holds runs, not a precomputed profile, for the same reason the epic does: the median and the sample threshold are derivation, and a stored fold cannot be recomputed when the rule changes.

The store is not a spego workspace and holds no artifacts. It is a plain data file outside any repo, and losing it costs evidence, not correctness — the ladder simply falls back a rung.

## Write path

The recording command writes the epic first and the store second. If the store write fails, the run is still recorded where it matters and the failure is reported rather than swallowed; the reverse order would risk counting a run that never landed on its change.

## Decisions

1. **Store path and format.** The root resolves from `SPEGO_STORE_ROOT` before falling back to the platform configuration directory (`$XDG_CONFIG_HOME/spego` or `~/.config/spego`; `%APPDATA%\spego` on Windows; `~/Library/Application Support/spego` on macOS). The environment variable names the root, not the file, so the layout can change later. Inside the root the store is a single append-only file, `runs.jsonl`, one JSON object per line — `{flow, tier, hours}` — because appends are cheap, partial reads degrade gracefully (a malformed line is dropped, the rest still count), and no write ever rewrites history.
2. **Runs carry no repo attribution.** The store ships without a repo field: attribution would let a maintainer see that one project runs slower than the rest, but it turns a cost store into a cross-project record of what was worked on and when. A run contributes only its Flow, Size Tier, and hours.

## Rejected alternatives

- **Always-on cross-project pricing** — one less flag, but every board becomes machine-dependent and the e2e contract stops being a contract.
- **Global store as the only store** — simpler resolution, but a repo's own evidence is the better predictor and should never be outvoted by an average over unrelated codebases.
