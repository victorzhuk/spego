import path from 'node:path';
import { writeGeneratedFile, removeGeneratedFile } from './write.js';
import { GENERATOR_VERSION } from './types.js';
import type { TargetGenerator, GenerationReport, GeneratedFile } from './types.js';

interface OpenCodeCommandAsset {
  relPath: string;
  content: string;
}

const SPEGO_APPLY = `---
description: Implement tasks from an OpenSpec change using the active OpenCode instance
---

Implement tasks from an OpenSpec change.

Input: optionally specify a change name after \`/spego-apply\`. If omitted, infer it from conversation context only when unambiguous. If multiple active changes could apply, run \`openspec list --json\` and ask the user to choose.

## Phases

### Phase 1 — Select the change

- If a change name is provided, announce: \`Using change: <name>\`.
- If omitted, run \`openspec list --json\` and ask the user to choose when multiple active changes exist.
- Do not guess or infer when more than one active change is possible.

### Phase 2 — Load context

- Run \`openspec status --change "<name>" --json\` to get current state.
- Run \`openspec instructions apply --change "<name>" --json\` to get context file paths.
- Read every file listed in \`contextFiles\`. Follow the schema-specific instruction from the CLI output; do not assume fixed artifact names.

### Phase 3 — Plan tasks

- Review the tasks artifact and identify all pending (unchecked) tasks.
- Determine execution order based on task dependencies and the change's design doc.
- Present the planned order to the user before proceeding.

### Phase 4 — Execute work

- Implement pending tasks in order, keeping each change minimal and scoped.
- Follow the repository's existing conventions, imports, and patterns.
- After completing each task, mark its checkbox in the tasks artifact from \`- [ ]\` to \`- [x]\`.

### Phase 5 — Verify results

- After each task, confirm the implementation aligns with the relevant spec and design decisions.
- Run available tests when the change or repository identifies them.
- If a task fails verification, note the issue and either fix it or pause for guidance.

### Phase 6 — Update task checkboxes

- After verifying a task, ensure its checkbox is marked \`- [x]\` in the tasks artifact.
- Only mark tasks complete when implementation and verification both succeed.
- Do not mark tasks that were skipped or left incomplete.

### Phase 7 — Summarize status

- Report completed tasks, remaining tasks, and any blockers encountered.
- Recommend the next OpenSpec action (continue, verify, or archive).
- Pause and ask the user when a task is ambiguous, implementation exposes a design/spec issue, or a blocker prevents safe progress.

## Subagents

Subagents may be used ONLY inside the current OpenCode session for independent investigation, implementation review, or verification. All subagent work runs within this instance using its existing model, agents, and permissions.

The following are forbidden:

- Spego spawning agents or orchestrating subagent pools.
- Spego choosing or switching models for subagents.
- Creating external sessions, connecting to daemons, or calling REST APIs.
- Any operation that leaves the current OpenCode process boundary.

## Guardrails

- Do not call the removed Spego orchestration command.
- Do not start or require a separate OpenCode daemon.
- Do not mutate OpenSpec lifecycle state except task checkboxes required by apply workflow.
- Use OpenCode's current model, agents, permissions, and runtime configuration.
`;

const SPEGO_VERIFY = `---
description: Verify implementation against OpenSpec change artifacts before archive
---

Verify that implementation matches a change's OpenSpec artifacts.

This command runs entirely inside the active OpenCode instance. Do not connect to a daemon or REST API.

Input: optionally specify a change name after \`/spego-verify\`. If omitted, ask the user to choose from active changes; do not guess.

## Steps

1. Select the change. If needed, run \`openspec list --json\` and ask the user.

2. Check status:

\`\`\`bash
openspec status --change "<name>" --json
\`\`\`

3. Load context paths:

\`\`\`bash
openspec instructions apply --change "<name>" --json
\`\`\`

4. Read all available files from \`contextFiles\`, including proposal, design, specs, and tasks when present.

5. Verify completeness: task checkboxes, requirement coverage, and any documented acceptance criteria.

6. Verify correctness: compare implementation evidence with each requirement and scenario. Reference concrete files and lines where possible.

7. Verify coherence: compare implementation with design decisions and repository patterns.

8. Run relevant tests when the change or repository identifies them. If no test command is obvious, state that explicitly.

9. Report findings grouped as CRITICAL, WARNING, and SUGGESTION, followed by a final archive-readiness assessment.

## Guardrails

- Do not call the removed Spego orchestration command.
- Do not start or require a separate OpenCode daemon.
- Do not mark OpenSpec lifecycle state complete or archive the change.
- Prefer actionable findings with file references over vague recommendations.
`;

const SPEGO_EXPLORE = `---
description: Explore ideas, problems, or OpenSpec changes without implementing code
---

Enter explore mode. Think through ideas, investigate code, clarify requirements, and surface options without implementing code.

This command runs entirely inside the active OpenCode instance. Do not connect to a daemon or REST API.

Input: anything after \`/spego-explore\` is the topic, problem, or change name to explore.

## Stance

- Be curious and grounded in the repository.
- Ask questions that emerge naturally from the evidence.
- Use concise diagrams or tables when they clarify trade-offs.
- Follow interesting threads without forcing a fixed workflow.

## OpenSpec Awareness

At the start, check active changes when relevant:

\`\`\`bash
openspec list --json
\`\`\`

If the user names a change, read its available artifacts such as proposal, design, specs, and tasks. Reference them naturally in the discussion.

## Capture Options

When insights crystallize, offer to capture them in the right OpenSpec artifact. Do not auto-capture unless the user asks.

## Guardrails

- Do not implement application code in explore mode.
- Do not call the removed Spego orchestration command.
- Do not start or require a separate OpenCode daemon.
- Creating or editing OpenSpec artifacts is allowed only when the user explicitly asks to capture the thinking.
`;

const COMMAND_ASSETS: OpenCodeCommandAsset[] = [
  { relPath: '.opencode/commands/spego-apply.md', content: SPEGO_APPLY },
  { relPath: '.opencode/commands/spego-verify.md', content: SPEGO_VERIFY },
  { relPath: '.opencode/commands/spego-explore.md', content: SPEGO_EXPLORE },
];

const STALE_ASSET_PATHS = [
  '.opencode/commands/orchestrate.md',
  '.opencode/commands/workflow.md',
  '.opencode/commands/opsx-new.md',
  '.opencode/commands/opsx-continue.md',
  '.opencode/commands/opsx-ff.md',
  '.opencode/commands/opsx-apply.md',
  '.opencode/commands/opsx-verify.md',
  '.opencode/commands/opsx-archive.md',
  '.opencode/commands/opsx-bulk-archive.md',
  '.opencode/commands/opsx-sync.md',
  '.opencode/commands/opsx-explore.md',
  '.opencode/agents/ultramanager.md',
  '.opencode/agents/ultraworker.md',
  '.opencode/agents/ultraverifier.md',
  '.opencode/agents/orchestrate.md',
  '.opencode/skills/openspec-new-change/SKILL.md',
  '.opencode/skills/openspec-continue-change/SKILL.md',
  '.opencode/skills/openspec-ff-change/SKILL.md',
  '.opencode/skills/openspec-apply-change/SKILL.md',
  '.opencode/skills/openspec-verify-change/SKILL.md',
  '.opencode/skills/openspec-archive-change/SKILL.md',
  '.opencode/skills/openspec-bulk-archive-change/SKILL.md',
  '.opencode/skills/openspec-sync-specs/SKILL.md',
  '.opencode/skills/openspec-explore/SKILL.md',
  '.opencode/skills/openspec-onboard/SKILL.md',
];

export class OpencodeGenerator implements TargetGenerator {
  readonly targetName = 'opencode';

  async generate(projectRoot: string): Promise<GenerationReport> {
    const files: GeneratedFile[] = [];

    for (const relPath of STALE_ASSET_PATHS) {
      const filePath = path.join(projectRoot, relPath);
      const action = await removeGeneratedFile(filePath);
      if (action) files.push({ path: filePath, action });
    }

    for (const asset of COMMAND_ASSETS) {
      const filePath = path.join(projectRoot, asset.relPath);
      const action = await writeGeneratedFile(filePath, asset.content);
      files.push({ path: filePath, action });
    }

    return { target: this.targetName, files, version: GENERATOR_VERSION };
  }
}
