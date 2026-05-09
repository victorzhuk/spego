## Product Overview

spego is a standalone, agent-first product orchestration service for AI-driven software teams. Designed for experienced developers and product leaders building startup MVPs, it exposes a set of skills/commands (fully agent-callable) to create, update, and organize all core product/project artifacts (PRD, OKRs, design docs, API, UX, architecture, ceremonies, BDD/spec flows, and more). All interaction occurs through agent skill calls (no human CLI prompts after setup); outputs are always structured (JSON, markdown) for clear downstream consumption or automation. Epic/task delivery is abstracted to pluggable adapters (default: OpenSpec), allowing painless future tech stack rewiring.

## Design & Visual Style

* Component library: Not applicable (headless/API/skill-based tool)
* Styling framework: Not applicable (no direct UI apart from agent-generated docs/views)
* Color scheme, theme, layout, typography: N/A (no end-user UI)
* Reference standard: Follow OpenSpec's clean, skill-driven UX for integration, artifact, and command surface
* Outputs (docs/artifacts): Rendered as markdown, optionally JSON as needed for advanced clients
* Skill manifest: Provides plain JSON skill definition files for all supported agents (Claude, Cursor, etc.), matching their conventions (slash commands, skills, or file-based triggers)

## Tech Stack

* Framework: Node.js (LTS), published as a CLI/service
* Language: TypeScript
* Database: Local SQLite via node:sqlite (Node.js built-in, synchronous)
* Auth: None (local, single-user for MVP)
* Hosting target: Local CLI; agent skills output for AI toolchains
* Key libraries: yaml, zod, slugify, commander, node:sqlite
* Adapter interface: Plugin structure for epic/task sub-tool; OpenSpec default, others pluggable via contract

## Pages & Navigation

* All "pages" are agent skills:
  * `/spego:init` — Setup project, generate skills for configured agents
  * `/spego:prd` — CR\*UD PRD document (JSON/markdown); input: seed/patch; output: full doc
  * `/spego:okr` — CR\*UD Objectives & Key Results
  * `/spego:retro` — Document a retrospective (create/read)
  * `/spego:sprint-plan` — Plan sprint at top level (set dates, goals, top epics; delegate details)
  * `/spego:brainstorm` — Generate and update brainstorm logs/features
  * `/spego:usecases` — CRUD use cases; supports BDD/scenario language, freeform or Gherkin
  * `/spego:design` — Capture product/design docs (ux/ui, workflow, story mapping, visuals as link or md)
  * `/spego:api` — Design or view API blueprint/design doc
  * `/spego:architecture` — Document solution/infra architecture, boundaries, flows
  * `/spego:decision` — Add/view an Architectural Decision Record (ADR)
  * `/spego:risk` — Add/update/view risk log (top project risks, open/closed)
  * `/spego:qa` — Capture QA test plans and outcomes at feature or release level
  * `/spego:view` — Dump any/all current artifacts as JSON or human-readable markdown bundle
  * `/spego:epics`, `/spego:tasks` — List/get metadata for epics/tasks, via adapter (never own detail delivery, only links/summaries)
* All artifacts are stored and versioned; agent may specify export format.

Navigation = skill/command invocation by agent; no manual flow or navigation UI.

## Core User Flows

**Flow 1: Project Bootstrap & Skill Registration**

1. User runs `spego init` (CLI) with target agent(s): generates agent-specific skill manifests
2. Claude/agent picks up generated skills (e.g., `/spego:prd`, `/spego:okr`, etc.)

**Flow 2: Author/Read/Update any Artifact**

1. In Claude: user/agent issues `/spego:prd update {json-patch}` or `/spego:architecture get`
2. spego responds with updated artifact as markdown (default) or JSON, structured for agent consumption or display
3. Past states/changes are versioned (can specify `revision` to retrieve)

**Flow 3: Planning & Ceremony**

1. User/agent issues `/spego:sprint-plan create {sprint-meta}`
2. spego persists and returns sprint plan, links current OKRs, lists top epics (by adapter cross-link)
3. Agent continues by assigning to delivery tool (openspec, other)

**Flow 4: Delegation to Execution Plane**

1. Agent issues `/spego:epics list` — gets all top-level epics
2. For epic planning or task breakdown, agent switches tool (OpenSpec default) via adapter pointer (the target tool's skills handle delivery)

**Key "first win":** The first `/spego:prd` or `/spego:brainstorm` command called by the agent generates a new (or updates existing) artifact and returns agent-ready, complete structure for review or subsequent action.

## Data Model & Backend

* **Artifact** (id: uuid, type: enum \[prd, okr, retro, design, api, architecture, usecases, decision, risk, brainstorm, qa, ceremony\], content: markdown/json, createdAt, updatedAt, revision, meta: json)
* **Sprint** (id: uuid, title: string, start: date, end: date, goal: string, okrRefs: \[string\], epicRefs: \[string\], status: enum \[planned, active, closed\], meta: json)
* **EpicLink** (id: uuid, title: string, adapter: string, externalId, status, data: json)
* **AgentSkill** (id: uuid, name: string, agentType: string, skillManifest: json, active: bool)
* All artifacts are versioned (auto-increment or UUID per revision)
* Adapter interface (for epics/tasks): points to current delivery tool, forwards relevant requests
* API: All CRUD via CLI/internal API; agent interface is local skill-executor (importable by agent runners)

## Key Components

* Agent Skill Generator: Given a project and set of wanted artifacts, generates skill manifests for all supported agents
* Artifact Engine: Handles structured CRUD for all doc types, dispatches to correct artifact logic (OKR, PRD, etc.)
* Output Engine: Transforms outputs into agent-friendly markdown and/or JSON
* Adapter Loader: Plugin pattern; default to OpenSpec epic/task provider, can be swapped
* Versioning: Rollback/restore per artifact

## AI Generation Notes

* No direct user prompts or CLI menu flows after `init` — all interaction by agent/skill
* Every artifact CRUD endpoint must be exposed as agent-callable skill with well-formed I/O schema (flat JSON patch or markdown fragment)
* All artifact outputs must be markdown-first (for agent chat readability), with optional JSON as requested
* Provide starter skill manifests for Claude Code, Cursor, etc. matching their conventions (slash, dash, or file-based commands)
* Pluggable epic/task adapters: contract is get/list (never update detail); must be easy to point at OpenSpec or swap
* Keep artifact structure minimal but complete — no boilerplate, just core essential fields
* Artifacts and skills must be extensible by adding new types and skills with minimal effort
* Support `spego view` and filtered `spego view --type api` agent calls for fast, agent-driven artifact bundle export
* CLI usage 100% limited to `init` and possibly manual backup/import/export for advanced use
* Provide demo seed data mode (single shell command)
* Designed to be embeddable/headless for any future AI toolchain
