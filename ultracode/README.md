# ultracode — Multi-Agent OpenCode Orchestrator

A fire-and-forget coding workflow that decomposes a requirement into
sub-tasks, spawns a parallel/sequential agent swarm, and verifies the
result — all driven by the OpenCode REST API.

```
Requirements
    │
    ▼
┌─────────────┐   TaskBreakdown JSON
│ UltraManager│ ─────────────────────┐
│ gpt-5.5     │                      │
└─────────────┘                      ▼
                            ┌────────────────────┐
                            │  Dependency Tiers  │
                            │  (topological sort)│
                            └─────────┬──────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
             ┌───────────┐   ┌───────────┐   ┌───────────┐
             │UltraWorker│   │UltraWorker│   │UltraWorker│
             │ glm-5.1   │   │ glm-5.1   │   │ glm-5.1   │
             └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
                   └───────────────┼───────────────┘
                                   ▼
                          ┌─────────────────┐
                          │  UltraVerifier  │
                          │   gpt-5.5       │
                          │ runs test suite │
                          └────────┬────────┘
                                   ▼
                              verdict.json
```

## Quick start

```bash
# 1. Start OpenCode headless server in your project root
opencode serve --port 4096

# 2. In another terminal, run ultracode
pip install httpx
python3 ultracode.py "Add Redis-backed rate limiting (100 req/min token bucket)
to the /v1/chat FastAPI endpoint. Include unit tests using pytest-asyncio."

# Or via /workflow slash command inside the OpenCode TUI:
/workflow Add Redis-backed rate limiting to /v1/chat
```

## Files

| File | Purpose |
|------|---------|
| `ultracode.py` | Main orchestration script |
| `opencode.json` | Agent definitions for OpenCode |
| `.opencode/agents/ultramanager.md` | Manager agent system prompt |
| `.opencode/agents/ultraworker.md` | Worker agent system prompt |
| `.opencode/agents/ultraverifier.md` | Verifier agent system prompt |
| `.opencode/commands/workflow.md` | `/workflow` slash command |

## CLI reference

```
python3 ultracode.py [OPTIONS] [REQUIREMENTS]

Arguments:
  REQUIREMENTS        Task description (or '-' for stdin)

Options:
  --file, -f PATH     Read requirements from a file
  --mode, -m MODE     sequential | parallel | adaptive
                      (default: let manager decide)
  --skip-verify       Skip verifier agent (fast iteration)
  --url URL           OpenCode server URL
                      (default: http://127.0.0.1:4096)
  --work-dir DIR      Artifact directory (default: .ultracode/)
```

## Execution modes

| Mode | When to use |
|------|------------|
| `sequential` | Tasks share many files or have fragile global state |
| `parallel` | Tasks are orthogonal — different modules, no shared files |
| `adaptive` | Mixed: parallel within each dependency tier (recommended default) |

## Rate-limit strategy

The script uses three model tiers:

1. **Manager / Verifier** (`gpt-5.5`) — low-volume, high-quality reasoning.
2. **Worker swarm** (`glm-5.1`) — high-volume parallel tasks; higher TPM quota.
3. **Fallback** (`gpt-5.5-mini`) — automatically activated when workers hit 429s.

On 429 the client applies exponential back-off with jitter and halves
`MAX_PARALLEL_SUBAGENTS` until the window recovers.

Set per-task model overrides in the TaskBreakdown JSON via `model_override`.

## Context management

| Agent | Context budget | Compact trigger |
|-------|---------------|----------------|
| Manager | 1 M tokens (gpt-5.5) | 80 % |
| Worker | 128 K tokens (glm-5.1) | 80 % |
| Verifier | 1 M tokens (gpt-5.5) | 80 % |

- Workers write intermediate summaries to `.ultracode/worker_<id>_progress.md`
  to keep their session lean.
- The Compaction agent (`opencode serve`) handles session-level compaction
  automatically.
- The orchestrator passes only `context_summary` (≤ 200 words) from the
  Manager into each worker — never the full history.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCODE_BASE_URL` | `http://127.0.0.1:4096` | OpenCode server |
| `OPENCODE_SERVER_USERNAME` | `opencode` | Basic auth user |
| `OPENCODE_SERVER_PASSWORD` | `` | Basic auth password |
| `ULTRACODE_WORK_DIR` | `.ultracode` | Artifact directory |

## Artifacts produced

After a run, `.ultracode/` contains:

```
.ultracode/
├── spec.md                  # Parsed requirement
├── context.md               # Codebase snapshot
├── breakdown.json           # Manager's TaskBreakdown
├── result_<task_id>.json    # Per-task result (success, diff, summary)
├── swarm.log                # Full swarm stdout/stderr
└── verdict.json             # Verifier's final verdict
```
