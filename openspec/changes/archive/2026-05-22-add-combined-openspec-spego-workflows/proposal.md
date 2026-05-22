## Why

spego and OpenSpec currently cover adjacent parts of the product workflow, but agents do not have a first-class guide for using them together. OpenSpec owns change execution, while spego owns durable product thinking; the combined flow should make that boundary explicit.

## What Changes

- Add combined OpenSpec + spego workflow guidance for before, during, and after implementation.
- Define first-class workflow expectations for brainstorming, reviewing, verifying, and retroing an OpenSpec change with spego artifacts.
- Clarify that OpenSpec remains the owner of change lifecycle mutations, while spego records durable artifacts such as `brainstorm`, `qa`, `risk`, and `retro`.
- Update generated workflow/docs behavior so agents can recommend combined flows without treating OpenSpec delivery state as mutable through spego.

## Capabilities

### New Capabilities

- `combined-openspec-spego-workflows`: Agent workflows that combine OpenSpec change state with spego artifacts.

### Modified Capabilities

- `spec-authoring-workflows`: Add recommendations that route active OpenSpec changes through combined spego/OpenSpec workflows.

## Impact

- `src/workflows/registry.ts`: New workflow metadata for combined change workflows and updated help recommendations.
- `src/generator/claude.ts`: Generated skill text must describe OpenSpec inputs and spego persistence points clearly.
- `README.md` and `CHANGELOG.md`: Document the combined workflow lanes and release-facing change summary.
- `.claude/skills/spego-*/SKILL.md`: Regenerated workflow skills after metadata changes.
