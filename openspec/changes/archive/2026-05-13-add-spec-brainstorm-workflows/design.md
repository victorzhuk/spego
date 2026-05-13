## Context

spego's generator currently has one source of truth for skills: `COMMAND_REGISTRY` in `src/commands/registry.ts`. The Claude target generator in `src/generator/claude.ts` iterates that registry and writes one `.claude/skills/spego-<command>/SKILL.md` per entry. There is no concept of a "process skill" — every skill is a thin wrapper around a single CLI invocation.

To bring BMAD-style brainstorming and adversarial review into spego, we need skills that drive a *multi-step process inside the agent's chat* and only call CLI commands at well-defined checkpoints (to persist artifacts). This is a different shape from a CLI-wrapper skill, and trying to encode it inside `COMMAND_REGISTRY` would conflate two concerns.

## Goals / Non-goals

**Goals**
- Add workflow skills as a first-class concept in the generator alongside command skills.
- Ship two reference workflow skills: party-mode brainstorming and adversarial review.
- Keep generation deterministic, idempotent, marker-based, and safe to overwrite (same rules as command skills).
- Make workflow definitions easy for users to extend via the registry pattern, not via raw markdown editing.

**Non-goals**
- Do **not** make spego execute workflows autonomously. Workflows are prompts/instructions for the agent; the agent runs them.
- Do **not** introduce a new artifact type. Outputs land in existing types (`brainstorm`, `qa`, `risk`, optionally `prd`/`design`/`decision`/`retro`).
- Do **not** change the artifact storage format, schemas, or revision semantics.
- Do **not** modify other agent targets in this change (only Claude is implemented today; OpenCode/Serena registration is out of scope).
- Do **not** ship more than the two reference workflows; "party" and "adversarial" are the BMAD-inspired starting set.

## Decisions

### Decision: Separate `WORKFLOW_REGISTRY` instead of overloading `COMMAND_REGISTRY`

**Why:** The two have different shapes (a workflow has personas/phases/output artifact types; a command has CLI flags), different generated content, and different semantics for the agent (one runs a CLI; the other guides a chat process). Keeping them separate prevents schema bloat and keeps `spego commands` output stable.

**Alternatives considered:**
- *Add a `kind: 'workflow' | 'command'` discriminator to `COMMAND_REGISTRY`.* Rejected: forces every command entry to carry workflow-only fields as optional, blurs the JSON shape returned by `spego commands`, and makes the generator template branchier.
- *Render workflow skills from raw markdown templates in `.spego/`.* Rejected: workflow skills must follow the same marker/frontmatter rules as command skills and survive regeneration; storing them as user-editable markdown duplicates the generator's responsibilities.

### Decision: Workflow skills only invoke `spego` via documented checkpoints

**Why:** Workflow skills are documentation that an agent reads; they cannot side-effect on their own. The only safe way for them to persist results is to instruct the agent to call existing CLI commands (`spego create`, `spego update`). This keeps the artifact engine the single point of validation.

**Implication:** Each workflow's `SKILL.md` ends with an explicit "Persist results" section that names which `spego` command to call and which artifact type to use. No new mutation surface is introduced.

### Decision: Personas live in the workflow definition, not in separate persona files

**Why:** BMAD splits personas into many files because its skills are independently composable. spego's two reference workflows are self-contained; embedding 4–6 personas inline in each `SKILL.md` keeps the skill discoverable in one read and avoids inventing a persona registry now. We can extract personas into their own registry later if a third workflow needs to reuse them.

### Decision: `spego workflows` mirrors `spego commands`

**Why:** The existing pattern is well-understood. Adding a parallel command keeps the CLI surface predictable and gives external tooling (and future non-Claude generators) a stable JSON view of available workflows.

## Workflow definitions (registry shape)

```ts
interface WorkflowMeta {
  name: string;                    // e.g. "brainstorm-party"
  description: string;             // what + when (Claude-style)
  personas: PersonaSpec[];         // ordered roles taken in turn
  phases: PhaseSpec[];             // open → diverge → converge → record
  inputs: WorkflowInput[];         // e.g. topic, source artifact id
  outputs: WorkflowOutput[];       // target artifact types + which CLI to use
  safety: string[];                // standard spego safety lines
}
```

The two reference workflows:

| Workflow | Personas | Output artifact types | Source artifact |
|---|---|---|---|
| `brainstorm-party` | PM, Architect, UX, Dev, QA, Skeptic | `brainstorm` (always); optional follow-up `prd` or `design` | none (topic input) |
| `review-adversarial` | Skeptic, Security, Reliability, UX, Cost | `qa` or `risk` (always); optional `decision` or `retro` | required (any artifact id/path) |

## Generator integration

- New `src/workflows/registry.ts` exporting `WORKFLOW_REGISTRY` and the two reference workflows.
- `src/generator/claude.ts` gains a `renderWorkflowSkillTemplate(meta)` paralleling `renderSkillTemplate(cmd)`.
- The Claude generator iterates both registries, writes both kinds of `SKILL.md`, and includes both in the generation report.
- `isLegacySpegoGenerated` cleanup logic continues to apply — workflow skills get the same `spego_generated: true` marker.

## Risks / Trade-offs

- **Skill drift between BMAD and spego:** spego's two workflows are *inspired by*, not 1:1 ports of, BMAD's skills. We accept divergence in exchange for tight integration with spego's artifact types and a smaller surface to maintain.
- **Persona inflation:** 6 personas in one `SKILL.md` makes the file long (~150 lines). Acceptable for v1; revisit if a third workflow shares 80%+ persona content with these two.
- **Agent compliance:** A workflow skill is only as good as the agent's willingness to follow it. We mitigate by keeping each phase short, named, and ending with a concrete CLI checkpoint, which is the same pattern that makes BMAD's workflows reliable.

## Migration

None. Running `spego regenerate` after upgrading writes the two new `SKILL.md` files and reports them as `created`. Existing command skills are unaffected.
