## Context

spego's UX is an agent command surface. OpenSpec's OPSX model shows the right pattern: generated skills are portable wrappers that call a local CLI for status, instructions, validation, and structured outputs.

## Goals / Non-Goals

**Goals:**

- Generate deterministic agent skill and command files during `spego init`.
- Start with Claude Code support and keep the generator model extensible for Cursor and other tools.
- Keep skill files thin; durable behavior lives in spego commands and shared templates.
- Make every command safe for agent use with non-interactive inputs and JSON output support.

**Non-Goals:**

- No custom hosted agent runtime.
- No interactive CLI menus after init.
- No full BMAD persona/menu system in the MVP.

## Decisions

### Skill files delegate to spego

Generated skills describe when to use a command and then call spego CLI/API operations for instructions and execution. They do not duplicate artifact persistence logic.

Alternative considered: embed full workflow logic in each generated skill. That is inspectable, but it creates drift across agent targets.

### Capability metadata drives generation

The generator reads a registry of command definitions, input schemas, output modes, and target adapter templates. Adding a new `/spego:*` command updates the registry first.

Alternative considered: handwritten skill files. That is faster initially but hard to keep consistent across agents.

### Markdown default, JSON explicit

Command output defaults to markdown for chat readability. `--format json` returns structured payloads for downstream automation.

Alternative considered: JSON-only. That works for tools but makes chat review harder.

## Risks / Trade-offs

- Agent platform differences → isolate path conventions and frontmatter formats in target adapters.
- Generated file drift → include a generator version and stable deterministic output.
- Prompt injection through artifact content → generated skills treat artifact text as data and avoid executing embedded instructions.

## Migration Plan

No migration exists. The first implementation generates Claude Code files under `.claude/skills/` and `.claude/commands/spego/`, then adds target adapters later.

## Open Questions

None for MVP planning.
