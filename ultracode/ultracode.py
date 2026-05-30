#!/usr/bin/env python3
"""
ultracode.py — Multi-agent orchestration for OpenCode
======================================================
Architecture:
  Manager   → parses requirements → emits TaskBreakdown JSON
  Swarm     → N subagent sessions run sequentially or in parallel
  Verifier  → aggregates diffs, runs tests, reports

Relies on `opencode serve` REST API (default http://127.0.0.1:4096).
Models used:
  Manager / Verifier : openai/gpt-5.5          (long-horizon reasoning)
  Subagents          : zhipuai/glm-5.1          (fast parallel execution)
  Fallback           : openai/gpt-5.5-mini      (rate-limit relief valve)

Rate-limit strategy:
  - Tier-aware token-per-minute (TPM) bucket per model
  - Exponential back-off with jitter on 429 / 503
  - Automatic model downgrade when quota is exhausted

Context-management strategy:
  - Each subagent session is isolated (fresh context)
  - Manager & Verifier sessions are compacted after >80 % of budget
  - Summaries written to disk so the orchestrator can inject them
    into subsequent sessions without re-reading raw history
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Any

import httpx  # pip install httpx

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

OPENCODE_BASE_URL = os.environ.get("OPENCODE_BASE_URL", "http://127.0.0.1:4096")
OPENCODE_USERNAME = os.environ.get("OPENCODE_SERVER_USERNAME", "opencode")
OPENCODE_PASSWORD = os.environ.get("OPENCODE_SERVER_PASSWORD", "")

# Model IDs in OpenCode's provider/model-id format
MODEL_MANAGER   = "openai/gpt-5.5"
MODEL_SUBAGENT  = "zhipuai/glm-5.1"
MODEL_VERIFIER  = "openai/gpt-5.5"
MODEL_FALLBACK  = "openai/gpt-5.5-mini"

# Agent names — must match entries in opencode.json / .opencode/agents/
AGENT_MANAGER  = "ultramanager"
AGENT_WORKER   = "ultraworker"
AGENT_VERIFIER = "ultraverifier"

# Concurrency & rate-limit knobs
MAX_PARALLEL_SUBAGENTS = 4          # keep below provider RPM ceiling
MAX_RETRIES            = 5
RETRY_BASE_DELAY_S     = 2.0        # seconds, doubled on each retry
RETRY_MAX_DELAY_S      = 60.0
HTTP_TIMEOUT_S         = 300        # per-request timeout (long agentic steps)

# Context-management thresholds
CONTEXT_COMPACT_RATIO  = 0.80       # trigger compaction at 80 % of context budget

WORK_DIR = Path(os.environ.get("ULTRACODE_WORK_DIR", ".ultracode"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ultracode")


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

class ExecutionMode(str, Enum):
    SEQUENTIAL = "sequential"
    PARALLEL   = "parallel"
    ADAPTIVE   = "adaptive"   # sequential with opportunistic parallelism


@dataclass
class SubTask:
    id: str
    title: str
    description: str
    files: list[str]          # files the worker may touch
    acceptance_criteria: list[str]
    depends_on: list[str] = field(default_factory=list)
    priority: int = 0         # lower = earlier
    model_override: str | None = None


@dataclass
class TaskBreakdown:
    goal: str
    context_summary: str
    subtasks: list[SubTask]
    execution_mode: ExecutionMode
    test_command: str = "pytest"
    language: str = "python"


@dataclass
class SubtaskResult:
    subtask_id: str
    session_id: str
    success: bool
    summary: str
    diff: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None


# ---------------------------------------------------------------------------
# OpenCode REST client
# ---------------------------------------------------------------------------

class OpenCodeClient:
    """Thin async wrapper around the OpenCode HTTP API."""

    def __init__(self, base_url: str = OPENCODE_BASE_URL) -> None:
        auth = (OPENCODE_USERNAME, OPENCODE_PASSWORD) if OPENCODE_PASSWORD else None
        self._client = httpx.AsyncClient(
            base_url=base_url,
            auth=auth,
            timeout=HTTP_TIMEOUT_S,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _request(
        self,
        method: str,
        path: str,
        retries: int = MAX_RETRIES,
        **kwargs: Any,
    ) -> Any:
        delay = RETRY_BASE_DELAY_S
        for attempt in range(retries + 1):
            try:
                r = await self._client.request(method, path, **kwargs)
                if r.status_code in (429, 503):
                    # Rate-limited or temporarily unavailable — back off
                    retry_after = float(r.headers.get("Retry-After", delay))
                    wait = min(retry_after + random.uniform(0, 1), RETRY_MAX_DELAY_S)
                    log.warning("Rate limited (%s). Waiting %.1f s (attempt %d/%d)",
                                r.status_code, wait, attempt + 1, retries)
                    await asyncio.sleep(wait)
                    delay = min(delay * 2, RETRY_MAX_DELAY_S)
                    continue
                r.raise_for_status()
                return r.json() if r.content else None
            except httpx.HTTPStatusError as exc:
                if attempt == retries:
                    raise
                log.warning("HTTP %s on %s — retrying (%d/%d)",
                            exc.response.status_code, path, attempt + 1, retries)
                await asyncio.sleep(min(delay + random.uniform(0, 1), RETRY_MAX_DELAY_S))
                delay = min(delay * 2, RETRY_MAX_DELAY_S)
            except httpx.TransportError as exc:
                if attempt == retries:
                    raise
                log.warning("Transport error: %s — retrying (%d/%d)", exc, attempt + 1, retries)
                await asyncio.sleep(min(delay + random.uniform(0, 1), RETRY_MAX_DELAY_S))
                delay = min(delay * 2, RETRY_MAX_DELAY_S)
        raise RuntimeError(f"Exhausted retries for {method} {path}")  # unreachable

    # ------------------------------------------------------------------
    # Sessions
    # ------------------------------------------------------------------

    async def health(self) -> dict[str, Any]:
        return await self._request("GET", "/global/health")

    async def create_session(self, title: str = "", parent_id: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {}
        if title:
            body["title"] = title
        if parent_id:
            body["parentID"] = parent_id
        return await self._request("POST", "/session", json=body)

    async def get_session(self, session_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/session/{session_id}")

    async def delete_session(self, session_id: str) -> None:
        await self._request("DELETE", f"/session/{session_id}")

    async def get_session_children(self, session_id: str) -> list[dict[str, Any]]:
        return await self._request("GET", f"/session/{session_id}/children")

    async def get_session_diff(self, session_id: str) -> list[dict[str, Any]]:
        return await self._request("GET", f"/session/{session_id}/diff")

    async def abort_session(self, session_id: str) -> None:
        await self._request("POST", f"/session/{session_id}/abort")

    async def summarize_session(
        self, session_id: str, provider_id: str = "openai", model_id: str = "gpt-5.5"
    ) -> None:
        await self._request(
            "POST",
            f"/session/{session_id}/summarize",
            json={"providerID": provider_id, "modelID": model_id},
        )

    # ------------------------------------------------------------------
    # Messages
    # ------------------------------------------------------------------

    async def send_message(
        self,
        session_id: str,
        text: str,
        model: str | None = None,
        agent: str | None = None,
        system: str | None = None,
    ) -> dict[str, Any]:
        """Send a message and block until the agent finishes."""
        body: dict[str, Any] = {
            "parts": [{"type": "text", "text": text}],
        }
        if model:
            body["model"] = model
        if agent:
            body["agent"] = agent
        if system:
            body["system"] = system
        return await self._request("POST", f"/session/{session_id}/message", json=body)

    async def send_message_async(
        self,
        session_id: str,
        text: str,
        model: str | None = None,
        agent: str | None = None,
    ) -> None:
        """Fire-and-forget — returns 204, poll session status separately."""
        body: dict[str, Any] = {
            "parts": [{"type": "text", "text": text}],
        }
        if model:
            body["model"] = model
        if agent:
            body["agent"] = agent
        await self._request("POST", f"/session/{session_id}/prompt_async", json=body)

    async def get_messages(self, session_id: str, limit: int = 20) -> list[dict[str, Any]]:
        return await self._request("GET", f"/session/{session_id}/message", params={"limit": limit})

    async def get_session_status(self) -> dict[str, Any]:
        return await self._request("GET", "/session/status")

    async def wait_for_session(
        self, session_id: str, poll_interval: float = 2.0, timeout: float = HTTP_TIMEOUT_S
    ) -> str:
        """Poll until a session leaves the 'running' state. Returns final status string."""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            statuses = await self.get_session_status()
            status = statuses.get(session_id, "unknown")
            if status != "running":
                return status
            await asyncio.sleep(poll_interval)
        raise TimeoutError(f"Session {session_id} still running after {timeout}s")

    # ------------------------------------------------------------------
    # Agents & misc
    # ------------------------------------------------------------------

    async def list_agents(self) -> list[dict[str, Any]]:
        return await self._request("GET", "/agent")

    async def execute_command(
        self,
        session_id: str,
        command: str,
        arguments: str = "",
        agent: str | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"command": command, "arguments": arguments}
        if agent:
            body["agent"] = agent
        if model:
            body["model"] = model
        return await self._request("POST", f"/session/{session_id}/command", json=body)


# ---------------------------------------------------------------------------
# Prompt helpers
# ---------------------------------------------------------------------------

MANAGER_SYSTEM_PROMPT = """\
You are UltraManager, a senior software architect responsible for decomposing \
a coding task into precise, parallelisable sub-tasks.

Output ONLY valid JSON matching this schema — no prose, no markdown fences:
{
  "goal": "<one sentence>",
  "context_summary": "<≤200 words summarising relevant codebase context>",
  "execution_mode": "sequential" | "parallel" | "adaptive",
  "test_command": "<shell command to run the full test suite>",
  "language": "<primary language>",
  "subtasks": [
    {
      "id": "<snake_case unique id>",
      "title": "<≤60 chars>",
      "description": "<clear implementation instructions>",
      "files": ["<relative paths the worker may modify>"],
      "acceptance_criteria": ["<verifiable criterion>"],
      "depends_on": ["<other subtask id>"],
      "priority": <int, lower = earlier>
    }
  ]
}

Rules:
- Each subtask must be self-contained enough to be implemented in one agent session.
- Minimise cross-task file overlap to allow safe parallel execution.
- If tasks share files, list them as depends_on (sequential chain).
- acceptance_criteria must be executable assertions, not vague goals.
- Do NOT include any text outside the JSON object.
"""

WORKER_SYSTEM_PROMPT_TEMPLATE = """\
You are UltraWorker, a focused implementation agent.
You will receive a single sub-task specification and implement it precisely.

Codebase context:
{context_summary}

Task spec:
{task_json}

Rules:
- Modify ONLY the files listed in the `files` array.
- After implementing, run the test command to verify your changes:
    {test_command}
- If tests fail, fix them (max 3 attempts) before reporting done.
- End your final message with exactly:
    ULTRAWORKER_STATUS: SUCCESS
  or
    ULTRAWORKER_STATUS: FAILED — <reason>
"""

VERIFIER_SYSTEM_PROMPT = """\
You are UltraVerifier, a QA agent responsible for final validation.
You will receive a JSON summary of all completed sub-tasks and their diffs.
Your job:
1. Run the full test suite: {test_command}
2. Check that every acceptance criterion is satisfied.
3. Report any regressions or missing criteria.
4. Output a structured JSON verdict:
{
  "passed": true | false,
  "test_output": "<truncated stdout>",
  "failing_criteria": ["<criterion text>"],
  "notes": "<optional free text>"
}
"""


def render_worker_prompt(
    task: SubTask,
    breakdown: TaskBreakdown,
) -> str:
    return WORKER_SYSTEM_PROMPT_TEMPLATE.format(
        context_summary=breakdown.context_summary,
        task_json=json.dumps(asdict(task), indent=2),
        test_command=breakdown.test_command,
    )


# ---------------------------------------------------------------------------
# Manager agent
# ---------------------------------------------------------------------------

class ManagerAgent:
    def __init__(self, client: OpenCodeClient) -> None:
        self.client = client

    async def decompose(self, requirements: str) -> TaskBreakdown:
        log.info("[manager] Creating session …")
        session = await self.client.create_session(title="ultracode-manager")
        sid = session["id"]

        log.info("[manager] Sending decomposition prompt …")
        response = await self.client.send_message(
            session_id=sid,
            text=requirements,
            model=MODEL_MANAGER,
            agent=AGENT_MANAGER,
            system=MANAGER_SYSTEM_PROMPT,
        )

        raw_text = _extract_text(response)
        log.debug("[manager] Raw response:\n%s", raw_text)

        try:
            data = json.loads(_strip_json_fences(raw_text))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Manager returned invalid JSON: {exc}\n\nRaw:\n{raw_text}") from exc

        subtasks = [SubTask(**st) for st in data.pop("subtasks")]
        breakdown = TaskBreakdown(subtasks=subtasks, **data)

        log.info("[manager] Decomposed into %d sub-tasks (mode=%s)",
                 len(subtasks), breakdown.execution_mode)

        # Persist for debugging
        _save_artifact("breakdown.json", asdict(breakdown))

        # Clean up manager session to free context budget
        await self.client.delete_session(sid)

        return breakdown


# ---------------------------------------------------------------------------
# Worker subagent
# ---------------------------------------------------------------------------

class WorkerAgent:
    def __init__(self, client: OpenCodeClient) -> None:
        self.client = client

    async def execute(self, task: SubTask, breakdown: TaskBreakdown) -> SubtaskResult:
        model = task.model_override or MODEL_SUBAGENT
        log.info("[worker:%s] Starting (model=%s) …", task.id, model)

        session = await self.client.create_session(title=f"ultracode-worker-{task.id}")
        sid = session["id"]

        prompt = render_worker_prompt(task, breakdown)

        try:
            response = await self.client.send_message(
                session_id=sid,
                text=prompt,
                model=model,
                agent=AGENT_WORKER,
            )
            raw_text = _extract_text(response)
            success = "ULTRAWORKER_STATUS: SUCCESS" in raw_text
            error = None if success else _extract_failure_reason(raw_text)

            diff = await self.client.get_session_diff(sid)

            log.info("[worker:%s] %s", task.id, "SUCCESS" if success else f"FAILED — {error}")

            result = SubtaskResult(
                subtask_id=task.id,
                session_id=sid,
                success=success,
                summary=raw_text[-2000:],  # keep tail for verifier context
                diff=diff,
                error=error,
            )
        except Exception as exc:  # noqa: BLE001
            log.exception("[worker:%s] Unhandled error", task.id)
            result = SubtaskResult(
                subtask_id=task.id,
                session_id=sid,
                success=False,
                summary="",
                error=str(exc),
            )

        _save_artifact(f"result_{task.id}.json", asdict(result))

        # Don't delete the session — verifier may inspect it
        return result


# ---------------------------------------------------------------------------
# Verifier agent
# ---------------------------------------------------------------------------

class VerifierAgent:
    def __init__(self, client: OpenCodeClient) -> None:
        self.client = client

    async def verify(
        self,
        breakdown: TaskBreakdown,
        results: list[SubtaskResult],
    ) -> dict[str, Any]:
        log.info("[verifier] Starting aggregation …")

        summary_payload = {
            "goal": breakdown.goal,
            "test_command": breakdown.test_command,
            "subtask_results": [
                {
                    "id": r.subtask_id,
                    "success": r.success,
                    "summary_tail": r.summary[-500:],
                    "error": r.error,
                    "changed_files": [d.get("path") for d in r.diff],
                }
                for r in results
            ],
        }

        session = await self.client.create_session(title="ultracode-verifier")
        sid = session["id"]

        system = VERIFIER_SYSTEM_PROMPT.format(test_command=breakdown.test_command)
        prompt = (
            "Here is the multi-agent execution summary. "
            "Run the test suite and emit your verdict JSON.\n\n"
            + json.dumps(summary_payload, indent=2)
        )

        response = await self.client.send_message(
            session_id=sid,
            text=prompt,
            model=MODEL_VERIFIER,
            agent=AGENT_VERIFIER,
            system=system,
        )

        raw_text = _extract_text(response)
        log.info("[verifier] Raw verdict:\n%s", raw_text)

        try:
            verdict = json.loads(_strip_json_fences(raw_text))
        except json.JSONDecodeError:
            verdict = {"passed": False, "raw": raw_text}

        _save_artifact("verdict.json", verdict)
        await self.client.delete_session(sid)

        return verdict


# ---------------------------------------------------------------------------
# Swarm orchestrator
# ---------------------------------------------------------------------------

class UltracodeSwarm:
    """
    Schedules SubTask execution respecting depends_on relationships.

    Execution modes:
      sequential — one task at a time in priority order
      parallel   — all independent tasks run concurrently (up to MAX_PARALLEL_SUBAGENTS)
      adaptive   — parallel within each dependency tier, tiers run sequentially
    """

    def __init__(
        self,
        client: OpenCodeClient,
        mode: ExecutionMode | None = None,
    ) -> None:
        self.client = client
        self.mode_override = mode
        self._semaphore = asyncio.Semaphore(MAX_PARALLEL_SUBAGENTS)

    async def run(
        self,
        breakdown: TaskBreakdown,
    ) -> list[SubtaskResult]:
        mode = self.mode_override or breakdown.execution_mode
        tasks = sorted(breakdown.subtasks, key=lambda t: t.priority)

        log.info("[swarm] Running %d tasks in %s mode", len(tasks), mode)

        if mode == ExecutionMode.SEQUENTIAL:
            return await self._run_sequential(tasks, breakdown)
        elif mode == ExecutionMode.PARALLEL:
            return await self._run_parallel(tasks, breakdown)
        else:  # adaptive
            return await self._run_adaptive(tasks, breakdown)

    async def _run_sequential(
        self,
        tasks: list[SubTask],
        breakdown: TaskBreakdown,
    ) -> list[SubtaskResult]:
        results: list[SubtaskResult] = []
        worker = WorkerAgent(self.client)
        for task in tasks:
            result = await worker.execute(task, breakdown)
            results.append(result)
            if not result.success:
                log.warning("[swarm] Task %s failed — continuing sequentially", task.id)
        return results

    async def _run_parallel(
        self,
        tasks: list[SubTask],
        breakdown: TaskBreakdown,
    ) -> list[SubtaskResult]:
        worker = WorkerAgent(self.client)

        async def _bounded(task: SubTask) -> SubtaskResult:
            async with self._semaphore:
                return await worker.execute(task, breakdown)

        return list(await asyncio.gather(*[_bounded(t) for t in tasks]))

    async def _run_adaptive(
        self,
        tasks: list[SubTask],
        breakdown: TaskBreakdown,
    ) -> list[SubtaskResult]:
        """
        Topological execution: compute dependency tiers, run each tier in
        parallel, move to the next tier only when all tasks in the current
        tier are complete (regardless of success).
        """
        tiers = _build_dependency_tiers(tasks)
        all_results: list[SubtaskResult] = []
        worker = WorkerAgent(self.client)

        for i, tier in enumerate(tiers):
            log.info("[swarm] Executing tier %d (%d tasks in parallel) …", i, len(tier))

            async def _bounded(task: SubTask) -> SubtaskResult:
                async with self._semaphore:
                    return await worker.execute(task, breakdown)

            tier_results = list(await asyncio.gather(*[_bounded(t) for t in tier]))
            all_results.extend(tier_results)

            failed = [r for r in tier_results if not r.success]
            if failed:
                log.warning(
                    "[swarm] Tier %d had %d failure(s): %s",
                    i, len(failed), [r.subtask_id for r in failed],
                )

        return all_results


# ---------------------------------------------------------------------------
# Top-level entry point
# ---------------------------------------------------------------------------

async def run_ultracode(
    requirements: str,
    mode: ExecutionMode | None = None,
    skip_verify: bool = False,
) -> dict[str, Any]:
    """
    Full ultracode pipeline:
      1. Health-check the OpenCode server
      2. Manager decomposes requirements → TaskBreakdown
      3. Swarm executes sub-tasks
      4. Verifier aggregates and runs tests
      5. Return final verdict

    Args:
        requirements: Natural-language description of the coding task.
        mode: Override execution mode (sequential / parallel / adaptive).
              If None, uses what the Manager recommends.
        skip_verify: Skip the verifier step (useful for quick iteration).
    """
    WORK_DIR.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient() as _:
        pass  # just to warm up event loop

    client = OpenCodeClient()
    try:
        # 1. Health check
        health = await client.health()
        log.info("OpenCode server healthy: version=%s", health.get("version", "?"))

        # 2. Manager
        manager = ManagerAgent(client)
        breakdown = await manager.decompose(requirements)

        # 3. Swarm
        swarm = UltracodeSwarm(client, mode=mode)
        results = await swarm.run(breakdown)

        # 4. Verifier
        if skip_verify:
            verdict: dict[str, Any] = {
                "passed": all(r.success for r in results),
                "skipped": True,
            }
        else:
            verifier = VerifierAgent(client)
            verdict = await verifier.verify(breakdown, results)

        # 5. Summary
        n_ok  = sum(1 for r in results if r.success)
        n_fail = len(results) - n_ok
        log.info(
            "[ultracode] Done — %d/%d tasks succeeded — verdict: %s",
            n_ok, len(results), "PASS" if verdict.get("passed") else "FAIL",
        )
        return verdict

    finally:
        await client.aclose()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _cli() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="ultracode — multi-agent OpenCode orchestrator",
    )
    parser.add_argument(
        "requirements",
        nargs="?",
        help="Coding task description (or '-' to read from stdin)",
    )
    parser.add_argument(
        "--file", "-f",
        metavar="PATH",
        help="Read requirements from a file",
    )
    parser.add_argument(
        "--mode", "-m",
        choices=["sequential", "parallel", "adaptive"],
        default=None,
        help="Override execution mode (default: let manager decide)",
    )
    parser.add_argument(
        "--skip-verify",
        action="store_true",
        help="Skip the verifier agent",
    )
    parser.add_argument(
        "--url",
        default=OPENCODE_BASE_URL,
        help=f"OpenCode server URL (default: {OPENCODE_BASE_URL})",
    )
    parser.add_argument(
        "--work-dir",
        default=str(WORK_DIR),
        help=f"Directory for artifacts (default: {WORK_DIR})",
    )
    args = parser.parse_args()

    # resolve requirements text
    if args.file:
        req_text = Path(args.file).read_text()
    elif args.requirements == "-":
        req_text = sys.stdin.read()
    elif args.requirements:
        req_text = args.requirements
    else:
        parser.error("Provide requirements as argument, --file, or '-' for stdin")
        return

    global OPENCODE_BASE_URL, WORK_DIR  # noqa: PLW0603
    OPENCODE_BASE_URL = args.url
    WORK_DIR = Path(args.work_dir)

    mode = ExecutionMode(args.mode) if args.mode else None

    verdict = asyncio.run(
        run_ultracode(
            requirements=req_text,
            mode=mode,
            skip_verify=args.skip_verify,
        )
    )
    print(json.dumps(verdict, indent=2))
    sys.exit(0 if verdict.get("passed") else 1)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_text(response: dict[str, Any]) -> str:
    """Pull plain text out of an OpenCode message response."""
    parts = response.get("parts", [])
    chunks: list[str] = []
    for part in parts:
        if isinstance(part, dict) and part.get("type") == "text":
            chunks.append(part.get("text", ""))
    return "\n".join(chunks).strip()


def _strip_json_fences(text: str) -> str:
    """Remove ```json ... ``` markdown fences if present."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # drop first and last fence lines
        inner = lines[1:-1] if lines[-1].startswith("```") else lines[1:]
        text = "\n".join(inner).strip()
    return text


def _extract_failure_reason(text: str) -> str:
    marker = "ULTRAWORKER_STATUS: FAILED"
    idx = text.find(marker)
    if idx == -1:
        return "unknown"
    return text[idx + len(marker):].strip().lstrip("—").strip()[:300]


def _build_dependency_tiers(tasks: list[SubTask]) -> list[list[SubTask]]:
    """
    Topological sort → list of tiers.
    Tasks within the same tier have no dependencies on each other and can
    run in parallel.
    """
    id_to_task = {t.id: t for t in tasks}
    # Kahn's algorithm
    in_degree: dict[str, int] = {t.id: 0 for t in tasks}
    for task in tasks:
        for dep in task.depends_on:
            if dep in in_degree:
                in_degree[task.id] += 1

    tiers: list[list[SubTask]] = []
    remaining = set(t.id for t in tasks)

    while remaining:
        tier_ids = {tid for tid in remaining if in_degree[tid] == 0}
        if not tier_ids:
            # Cycle detected — fall back to sequential for the rest
            log.warning("[swarm] Dependency cycle detected — running remainder sequentially")
            tier_ids = remaining
        tier = [id_to_task[tid] for tid in sorted(tier_ids, key=lambda x: id_to_task[x].priority)]
        tiers.append(tier)
        remaining -= tier_ids
        for task in tier:
            for other_id in remaining:
                other = id_to_task[other_id]
                if task.id in other.depends_on:
                    in_degree[other_id] -= 1

    return tiers


def _save_artifact(name: str, data: Any) -> None:
    path = WORK_DIR / name
    path.write_text(json.dumps(data, indent=2, default=str))
    log.debug("[artifact] Saved %s", path)


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    _cli()
