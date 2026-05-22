## Context

OpenSpec already manages change artifacts and lifecycle commands through OPSX prompts. spego already manages product artifacts and exposes OpenSpec changes read-only through `spego epics` and `spego tasks`.

The combined model keeps these responsibilities separate:

- OpenSpec owns proposal, specs, design, tasks, apply, verify, sync, and archive.
- spego owns durable brainstorming, QA, risk, architecture, PRD, and retro artifacts.

## Goals

- Give agents explicit workflows for using both systems together.
- Persist useful thinking from OpenSpec work as spego artifacts.
- Avoid hidden delivery mutations through spego.

## Non-goals

- Do not replace OPSX/OpenSpec commands.
- Do not make the spego delivery adapter mutate OpenSpec changes.
- Do not add a new OpenSpec parser beyond the current epics/tasks read model.
- Do not add PRD-to-OpenSpec change creation in this change.

## Approach

Add workflow registry entries that take an OpenSpec change name as context and persist their output through the existing spego artifact CLI.

The workflow set is:

- `change-brainstorm`: Read an OpenSpec change and create a `brainstorm` artifact.
- `change-review`: Review proposal/spec/design/tasks and create a `qa` or `risk` artifact.
- `change-verify-report`: Capture verification findings as a `qa` artifact after OPSX verification.
- `change-retro`: Create a `retro` artifact for completed or archived changes.

Each workflow reads OpenSpec context using the safest available source:

- `spego epics --json` and `spego tasks --change <name> --json` for summary state.
- Direct reads of OpenSpec change artifacts when deeper context is needed.
- OPSX/OpenSpec commands for lifecycle actions, not spego delivery APIs.

## Agent Behavior

Agents should use combined flows when a user mentions an OpenSpec change and asks to brainstorm, review, verify, summarize, or prepare related product artifacts.

Agents should not update OpenSpec through `spego epics` or `spego tasks`. If a combined workflow discovers a needed OpenSpec mutation, it should recommend the matching OPSX/OpenSpec action.

## Persistence

Combined workflows persist only through existing spego commands:

- `spego --json create --type brainstorm`
- `spego --json create --type qa`
- `spego --json create --type risk`
- `spego --json create --type retro`

If a workflow updates an existing spego artifact, it must use `spego --json update --expected-revision`.

## Compatibility

The change is additive. Existing spego commands, existing workflow skills, and OPSX prompts continue to work.
