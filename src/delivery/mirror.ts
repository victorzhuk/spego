import { createHash } from 'node:crypto';
import type { DeliveryStatus } from './types.js';

export type WarningCode =
  | 'dangling-dep'
  | 'dep-cycle'
  | 'out-of-order-dep'
  | 'ungroomed-change'
  | 'orphan-epic'
  | 'archived-in-sprint'
  | 'closable-sprint'
  | 'adapter-warning'
  | 'adapter-unavailable';

export interface MirrorWarning {
  code: WarningCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface MirrorArtifact {
  id: string;
  type: string;
  slug: string;
  title: string;
  meta: Record<string, unknown>;
}

export interface MirrorSourceChange {
  slug: string;
  title: string;
  status: DeliveryStatus;
  archived?: boolean;
  warnings?: string[];
}

export interface MirrorInput {
  changes: MirrorSourceChange[];
  epics: MirrorArtifact[];
  sprints: MirrorArtifact[];
  linkedArtifacts?: MirrorArtifact[];
  warnings?: MirrorWarning[];
}

export interface MirrorGap {
  flag: string;
  note?: string;
}

export interface MirrorChange {
  id: string;
  slug: string;
  title: string;
  status: DeliveryStatus;
  blockers: string[];
  group: string;
  gaps: MirrorGap[];
  missing: string[];
  warnings: WarningCode[];
  archived: boolean;
}

export interface MirrorSprint {
  slug: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  changes: MirrorChange[];
}

export interface MirrorNext {
  change: string;
  sprint: string;
  reason: string;
}

export interface MirrorBoard {
  sprints: MirrorSprint[];
  ungrouped: MirrorChange[];
  warnings: MirrorWarning[];
  next: MirrorNext | null;
}

interface SprintPlan {
  artifact: MirrorArtifact;
  order: number;
  parsedStart: number;
  changes: string[];
  status: string;
  startDate: string | null;
  endDate: string | null;
}

interface ChangeState {
  slug: string;
  title: string;
  status: DeliveryStatus;
  archived: boolean;
  epic?: MirrorArtifact;
}

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
const STATUS_VALUES: Record<DeliveryStatus, true> = {
  backlog: true,
  'in-progress': true,
  done: true,
  completed: true,
  blocked: true,
  paused: true,
  unknown: true,
};
const WARNING_ORDER: Record<WarningCode, number> = {
  'adapter-unavailable': 0,
  'adapter-warning': 1,
  'archived-in-sprint': 2,
  'closable-sprint': 3,
  'dangling-dep': 4,
  'dep-cycle': 5,
  'out-of-order-dep': 6,
  'orphan-epic': 7,
  'ungroomed-change': 8,
};

export function deriveMirror(input: MirrorInput): MirrorBoard {
  const sortedChanges = [...input.changes].sort((a, b) => a.slug.localeCompare(b.slug));
  const sortedEpics = sortArtifacts(input.epics);
  const sortedSprintArtifacts = sortArtifacts(input.sprints);
  const linkedById = new Map((input.linkedArtifacts ?? []).map((artifact) => [artifact.id, artifact]));
  const inputChangeBySlug = new Map(sortedChanges.map((item) => [item.slug, item]));
  const epicsBySlug = new Map(sortedEpics.map((item) => [item.slug, item]));
  const changeStates = new Map<string, ChangeState>();

  for (const item of sortedChanges) {
    changeStates.set(item.slug, {
      slug: item.slug,
      title: item.title,
      status: item.archived ? 'completed' : item.status,
      archived: item.archived === true,
    });
  }
  for (const epic of sortedEpics) {
    const current = changeStates.get(epic.slug);
    if (current) {
      current.title = epic.title;
      current.epic = epic;
      if (!current.archived) {
        const override = statusOverride(epic.meta);
        if (override) current.status = override;
      }
      continue;
    }
    changeStates.set(epic.slug, {
      slug: epic.slug,
      title: epic.title,
      status: statusFromMeta(epic.meta),
      archived: false,
      epic,
    });
  }

  const sprints = sortedSprintArtifacts.map((artifact) => toSprintPlan(artifact));
  sprints.sort(compareSprints);
  sprints.forEach((sprint, index) => {
    sprint.order = index;
  });

  const scheduled = new Set<string>();
  const scheduleBySlug = new Map<string, number>();
  for (const sprint of sprints) {
    for (const slug of sprint.changes) {
      scheduled.add(slug);
      const current = scheduleBySlug.get(slug);
      if (current === undefined || sprint.order < current) scheduleBySlug.set(slug, sprint.order);
      if (!changeStates.has(slug)) {
        const discovered = inputChangeBySlug.get(slug);
        changeStates.set(slug, {
          slug,
          title: discovered?.title ?? slug,
          status: discovered?.archived ? 'completed' : discovered?.status ?? 'unknown',
          archived: discovered?.archived === true,
          epic: epicsBySlug.get(slug),
        });
      }
    }
  }

  const knownSlugs = new Set(changeStates.keys());
  const sortedSlugs = [...knownSlugs].sort();
  const idBySlug = assignChangeIds(sortedSlugs);
  const depsBySlug = new Map<string, string[]>();
  for (const [slug, state] of [...changeStates].sort((a, b) => a[0].localeCompare(b[0]))) {
    depsBySlug.set(slug, uniqueStrings(state.epic?.meta.deps));
  }
  const cycleMembers = findCycleMembers([...knownSlugs].sort(), depsBySlug, knownSlugs);
  const warnings: MirrorWarning[] = [...(input.warnings ?? [])];

  for (const source of sortedChanges) {
    for (const warning of source.warnings ?? []) {
      warnings.push({
        code: 'adapter-warning',
        message: `${source.slug}: ${warning}`,
        details: { change: source.slug, warning },
      });
    }
  }
  for (const source of sortedChanges) {
    if (source.archived) continue;
    if (epicsBySlug.has(source.slug)) continue;
    warnings.push({
      code: 'ungroomed-change',
      message: `Active change "${source.slug}" has no epic artifact.`,
      details: { change: source.slug },
    });
  }
  for (const epic of sortedEpics) {
    const source = inputChangeBySlug.get(epic.slug);
    if (!source) {
      warnings.push({
        code: 'orphan-epic',
        message: `Epic "${epic.slug}" does not resolve to an OpenSpec change.`,
        details: { change: epic.slug, reason: 'missing' },
      });
      continue;
    }
    if (source.archived) {
      warnings.push({
        code: 'orphan-epic',
        message: `Epic "${epic.slug}" points at an archived OpenSpec change.`,
        details: { change: epic.slug, reason: 'archived' },
      });
    }
  }
  for (const sprint of sprints) {
    for (const slug of sprint.changes) {
      if (!inputChangeBySlug.get(slug)?.archived) continue;
      warnings.push({
        code: 'archived-in-sprint',
        message: `Sprint "${sprint.artifact.slug}" includes archived change "${slug}".`,
        details: { sprint: sprint.artifact.slug, change: slug },
      });
    }
  }
  for (const [slug, deps] of [...depsBySlug].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const dep of deps) {
      if (knownSlugs.has(dep)) continue;
      warnings.push({
        code: 'dangling-dep',
        message: `Change "${slug}" depends on unknown change "${dep}".`,
        details: { change: slug, dep },
      });
    }
  }
  for (const slug of [...cycleMembers].sort()) {
    warnings.push({
      code: 'dep-cycle',
      message: `Change "${slug}" is part of a dependency cycle.`,
      details: { change: slug, cycle: [...cycleMembers].sort() },
    });
  }

  const cycleReach = new Map<string, boolean>();
  const blockersBySlug = new Map<string, string[]>();
  for (const slug of sortedSlugs) {
    blockersBySlug.set(
      slug,
      blockersFor(slug, depsBySlug, knownSlugs, changeStates, scheduleBySlug, cycleMembers, cycleReach),
    );
  }

  for (const slug of sortedSlugs) {
    if (!scheduleBySlug.has(slug)) continue;
    for (const dep of blockersBySlug.get(slug) ?? []) {
      if (!knownSlugs.has(dep)) continue;
      if (!scheduleBySlug.has(dep)) continue;
      if (scheduleBySlug.get(dep)! <= scheduleBySlug.get(slug)!) continue;
      warnings.push({
        code: 'out-of-order-dep',
        message: `Change "${slug}" depends on "${dep}", which is scheduled in a later sprint.`,
        details: { change: slug, dep },
      });
    }
  }

  const waveMemo = new Map<string, Wave>();
  const groupBySlug = new Map<string, string>();
  for (const slug of sortedSlugs) {
    groupBySlug.set(slug, renderGroup(computeWave(slug, blockersBySlug, changeStates, knownSlugs, waveMemo)));
  }

  const sortedWarnings = sortWarnings(warnings);
  const warningCodesByChange = new Map<string, WarningCode[]>();
  for (const warning of sortedWarnings) {
    const change = typeof warning.details?.change === 'string' ? warning.details.change : undefined;
    if (!change) continue;
    const codes = warningCodesByChange.get(change) ?? [];
    codes.push(warning.code);
    warningCodesByChange.set(change, codes);
  }

  const missingBySlug = new Map<string, string[]>();
  const gapsBySlug = new Map<string, MirrorGap[]>();
  for (const [slug, state] of [...changeStates].sort((a, b) => a[0].localeCompare(b[0]))) {
    const epic = state.epic;
    if (!epic) {
      missingBySlug.set(slug, []);
      gapsBySlug.set(slug, []);
      continue;
    }
    const links = uniqueStrings(epic.meta.links);
    const coveredTypes = new Set<string>();
    for (const id of links) {
      const linked = linkedById.get(id);
      if (linked) coveredTypes.add(linked.type);
    }
    missingBySlug.set(
      slug,
      uniqueStrings(epic.meta.requires).filter((type) => !coveredTypes.has(type)).sort(),
    );
    gapsBySlug.set(slug, gapsFromMeta(epic.meta.gaps));
  }

  const toMirrorChange = (slug: string): MirrorChange => {
    const state = changeStates.get(slug);
    return {
      id: idBySlug.get(slug) ?? slug,
      slug,
      title: state?.title ?? slug,
      status: state?.status ?? 'unknown',
      blockers: blockersBySlug.get(slug) ?? [],
      group: groupBySlug.get(slug) ?? '!',
      gaps: gapsBySlug.get(slug) ?? [],
      missing: missingBySlug.get(slug) ?? [],
      warnings: warningCodesByChange.get(slug) ?? [],
      archived: state?.archived ?? false,
    };
  };

  const sprintRows: MirrorSprint[] = sprints.map((sprint) => ({
    slug: sprint.artifact.slug,
    title: sprint.artifact.title,
    status: sprint.status,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    changes: sprint.changes.map((slug) => toMirrorChange(slug)),
  }));
  for (const sprint of sprintRows) {
    if (sprint.status === 'closed') continue;
    if (sprint.changes.length === 0) continue;
    if (!sprint.changes.every((item) => item.status === 'completed' || item.status === 'done')) continue;
    sortedWarnings.push({
      code: 'closable-sprint',
      message: `Sprint "${sprint.slug}" has no pending changes and can be closed.`,
      details: { sprint: sprint.slug },
    });
  }
  const finalWarnings = sortWarnings(sortedWarnings);
  const finalWarningCodesByChange = new Map<string, WarningCode[]>();
  for (const warning of finalWarnings) {
    const change = typeof warning.details?.change === 'string' ? warning.details.change : undefined;
    if (!change) continue;
    const codes = finalWarningCodesByChange.get(change) ?? [];
    codes.push(warning.code);
    finalWarningCodesByChange.set(change, codes);
  }
  for (const sprint of sprintRows) {
    sprint.changes = sprint.changes.map((item) => ({
      ...item,
      warnings: finalWarningCodesByChange.get(item.slug) ?? item.warnings,
    }));
  }

  const ungrouped = [...changeStates.keys()]
    .filter((slug) => !scheduled.has(slug))
    .sort()
    .map((slug) => {
      const item = toMirrorChange(slug);
      return { ...item, warnings: finalWarningCodesByChange.get(slug) ?? item.warnings };
    });

  return {
    sprints: sprintRows,
    ungrouped,
    warnings: finalWarnings,
    next: chooseNext(sprintRows),
  };
}

export function filterMirrorGaps(board: MirrorBoard): MirrorBoard {
  return {
    sprints: board.sprints.map((sprint) => ({
      ...sprint,
      changes: sprint.changes.filter(hasGapSignal),
    })),
    ungrouped: board.ungrouped.filter(hasGapSignal),
    warnings: board.warnings,
    next: board.next,
  };
}

export function filterMirrorArchived(board: MirrorBoard): MirrorBoard {
  return {
    sprints: board.sprints,
    ungrouped: board.ungrouped.filter((change) => !change.archived),
    warnings: board.warnings,
    next: board.next,
  };
}

export interface SprintSummary {
  id: string;
  slug: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  changes: string[];
}

/** Sprint-plan listing in the same order the board uses: start date, undated last, then slug. */
export function summarizeSprints(artifacts: MirrorArtifact[]): SprintSummary[] {
  const plans = sortArtifacts(artifacts).map(toSprintPlan);
  plans.sort(compareSprints);
  return plans.map((plan) => ({
    id: plan.artifact.id,
    slug: plan.artifact.slug,
    title: plan.artifact.title,
    status: plan.status,
    startDate: plan.startDate,
    endDate: plan.endDate,
    changes: plan.changes,
  }));
}

function sortArtifacts(artifacts: MirrorArtifact[]): MirrorArtifact[] {
  const copy = [...artifacts];
  copy.sort((a, b) => {
    const bySlug = a.slug.localeCompare(b.slug);
    if (bySlug !== 0) return bySlug;
    return a.id.localeCompare(b.id);
  });
  return copy;
}

function statusFromMeta(meta: Record<string, unknown>): DeliveryStatus {
  if (typeof meta.status === 'string' && STATUS_VALUES[meta.status as DeliveryStatus]) {
    return meta.status as DeliveryStatus;
  }
  return 'unknown';
}

/**
 * Manual override for a known change is intentionally narrower than
 * statusFromMeta's orphan-epic fallback: only blocked/paused are subjective
 * states with no filesystem signal, so only they can override a derived status.
 */
function statusOverride(meta: Record<string, unknown>): DeliveryStatus | undefined {
  return meta.status === 'blocked' || meta.status === 'paused' ? meta.status : undefined;
}

function toSprintPlan(artifact: MirrorArtifact): SprintPlan {
  const start = normalizeDateField(artifact.meta.startDate);
  return {
    artifact,
    order: 0,
    parsedStart: start.sortKey,
    changes: uniqueStrings(artifact.meta.changes),
    status: typeof artifact.meta.status === 'string' ? artifact.meta.status : 'planned',
    startDate: start.value,
    endDate: normalizeDateField(artifact.meta.endDate).value,
  };
}

function normalizeDateField(value: unknown): { sortKey: number; value: string | null } {
  if (typeof value !== 'string') return { sortKey: Number.POSITIVE_INFINITY, value: null };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { sortKey: Number.POSITIVE_INFINITY, value: null };
  if (!ISO_DATE_PREFIX.test(trimmed)) return { sortKey: Number.POSITIVE_INFINITY, value: trimmed };
  const time = new Date(trimmed).getTime();
  if (!Number.isFinite(time)) return { sortKey: Number.POSITIVE_INFINITY, value: trimmed };
  return { sortKey: time, value: trimmed };
}

function compareSprints(a: SprintPlan, b: SprintPlan): number {
  const byDate = a.parsedStart - b.parsedStart;
  if (!Number.isNaN(byDate) && byDate !== 0) return byDate;
  return a.artifact.slug.localeCompare(b.artifact.slug);
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function gapsFromMeta(value: unknown): MirrorGap[] {
  if (!Array.isArray(value)) return [];
  const gaps: MirrorGap[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.flag !== 'string' || record.flag.length === 0) continue;
    const gap: MirrorGap = { flag: record.flag };
    if (typeof record.note === 'string') gap.note = record.note;
    gaps.push(gap);
  }
  return gaps;
}

const ID_HEX_LEN = 4;
const ID_HEX_LEN_MAX = 40;

function sha1Hex(value: string): string {
  return createHash('sha1').update(value).digest('hex');
}

/**
 * Deterministic id per slug: `c` + sha1(slug) hex prefix. Stable across board
 * membership changes since it depends only on the slug itself, not position.
 * On a same-length collision, only the colliding slugs get one more hex char,
 * checked again; bounded by sha1's 40-hex-char length like findCycleMembers'
 * step cap bounds its walk.
 */
function assignChangeIds(slugs: string[]): Map<string, string> {
  const fullHashBySlug = new Map(slugs.map((slug) => [slug, sha1Hex(slug)]));
  const hexLenBySlug = new Map(slugs.map((slug) => [slug, ID_HEX_LEN]));
  let colliding = new Set(slugs);
  let steps = 0;
  const maxSteps = ID_HEX_LEN_MAX - ID_HEX_LEN + slugs.length + 10;

  while (colliding.size > 1 && steps < maxSteps) {
    steps += 1;
    const slugsByCode = new Map<string, string[]>();
    for (const slug of colliding) {
      const code = fullHashBySlug.get(slug)!.slice(0, hexLenBySlug.get(slug)!);
      const group = slugsByCode.get(code);
      if (group) group.push(slug);
      else slugsByCode.set(code, [slug]);
    }
    const next = new Set<string>();
    for (const group of slugsByCode.values()) {
      if (group.length < 2) continue;
      for (const slug of group) {
        const len = hexLenBySlug.get(slug)!;
        if (len >= ID_HEX_LEN_MAX) continue;
        hexLenBySlug.set(slug, len + 1);
        next.add(slug);
      }
    }
    colliding = next;
  }

  return new Map(slugs.map((slug) => [slug, `c${fullHashBySlug.get(slug)!.slice(0, hexLenBySlug.get(slug)!)}`]));
}

function findCycleMembers(
  slugs: string[],
  depsBySlug: Map<string, string[]>,
  knownSlugs: Set<string>,
): Set<string> {
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const stackIndex = new Map<string, number>();
  const members = new Set<string>();
  let steps = 0;
  const maxSteps = Math.max(100, slugs.length * slugs.length + slugs.length);

  const visit = (slug: string): void => {
    if (state.get(slug) === 'done') return;
    if (steps > maxSteps) {
      for (const item of stack) members.add(item);
      return;
    }
    steps += 1;
    state.set(slug, 'visiting');
    stackIndex.set(slug, stack.length);
    stack.push(slug);
    for (const dep of [...(depsBySlug.get(slug) ?? [])].sort()) {
      if (!knownSlugs.has(dep)) continue;
      const depState = state.get(dep);
      if (depState === 'visiting') {
        const start = stackIndex.get(dep) ?? 0;
        for (const item of stack.slice(start)) members.add(item);
        continue;
      }
      visit(dep);
    }
    stack.pop();
    stackIndex.delete(slug);
    state.set(slug, 'done');
  };

  for (const slug of slugs) visit(slug);
  return members;
}

function blockersFor(
  slug: string,
  depsBySlug: Map<string, string[]>,
  knownSlugs: Set<string>,
  states: Map<string, ChangeState>,
  scheduleBySlug: Map<string, number>,
  cycleMembers: Set<string>,
  cycleReach: Map<string, boolean>,
): string[] {
  const blockers = new Set<string>();
  if (cycleMembers.has(slug)) blockers.add('dep-cycle');
  const currentSchedule = scheduleBySlug.get(slug);
  for (const dep of depsBySlug.get(slug) ?? []) {
    if (!knownSlugs.has(dep)) {
      blockers.add(dep);
      continue;
    }
    if (leadsToCycle(dep, depsBySlug, knownSlugs, cycleMembers, cycleReach, new Set())) {
      blockers.add(dep);
      continue;
    }
    const depStatus = states.get(dep)?.status;
    if (depStatus === 'completed' || depStatus === 'done') continue;
    const depSchedule = scheduleBySlug.get(dep);
    if (currentSchedule !== undefined && depSchedule !== undefined && depSchedule <= currentSchedule) continue;
    blockers.add(dep);
  }
  return [...blockers].sort();
}

type Wave = number | 'done' | 'unresolved';

/**
 * Longest-path DAG level for `slug`, memoized. Two changes anywhere on the
 * board with the same wave are guaranteed to have no dependency path between
 * them, so they can run in parallel regardless of sprint boundaries.
 */
function computeWave(
  slug: string,
  blockersBySlug: Map<string, string[]>,
  changeStates: Map<string, ChangeState>,
  knownSlugs: Set<string>,
  memo: Map<string, Wave>,
): Wave {
  const cached = memo.get(slug);
  if (cached !== undefined) return cached;
  const status = changeStates.get(slug)?.status;
  if (status === 'completed' || status === 'done') {
    memo.set(slug, 'done');
    return 'done';
  }
  const blockers = blockersBySlug.get(slug) ?? [];
  if (blockers.some((token) => !knownSlugs.has(token))) {
    memo.set(slug, 'unresolved');
    return 'unresolved';
  }
  let maxBlockerWave = -1;
  for (const blocker of blockers) {
    const wave = computeWave(blocker, blockersBySlug, changeStates, knownSlugs, memo);
    if (wave === 'unresolved') {
      memo.set(slug, 'unresolved');
      return 'unresolved';
    }
    if (wave !== 'done' && wave > maxBlockerWave) maxBlockerWave = wave;
  }
  const result = maxBlockerWave + 1;
  memo.set(slug, result);
  return result;
}

function renderGroup(wave: Wave): string {
  if (wave === 'unresolved') return '!';
  if (wave === 'done') return '—';
  return `g${String(wave + 1).padStart(3, '0')}`;
}

function leadsToCycle(
  slug: string,
  depsBySlug: Map<string, string[]>,
  knownSlugs: Set<string>,
  cycleMembers: Set<string>,
  memo: Map<string, boolean>,
  seen: Set<string>,
): boolean {
  const cached = memo.get(slug);
  if (cached !== undefined) return cached;
  if (cycleMembers.has(slug)) {
    memo.set(slug, true);
    return true;
  }
  if (seen.has(slug)) return false;
  seen.add(slug);
  for (const dep of depsBySlug.get(slug) ?? []) {
    if (!knownSlugs.has(dep)) continue;
    if (leadsToCycle(dep, depsBySlug, knownSlugs, cycleMembers, memo, seen)) {
      memo.set(slug, true);
      seen.delete(slug);
      return true;
    }
  }
  seen.delete(slug);
  memo.set(slug, false);
  return false;
}

function sortWarnings(warnings: MirrorWarning[]): MirrorWarning[] {
  const copy = [...warnings];
  copy.sort((a, b) => {
    const byCode = WARNING_ORDER[a.code] - WARNING_ORDER[b.code];
    if (byCode !== 0) return byCode;
    const aDetail = warningSortKey(a);
    const bDetail = warningSortKey(b);
    return aDetail.localeCompare(bDetail);
  });
  return copy;
}

function warningSortKey(warning: MirrorWarning): string {
  const details = warning.details ?? {};
  const change = typeof details.change === 'string' ? details.change : '';
  const sprint = typeof details.sprint === 'string' ? details.sprint : '';
  const dep = typeof details.dep === 'string' ? details.dep : '';
  return `${change}\u0000${sprint}\u0000${dep}\u0000${warning.message}`;
}

function chooseNext(sprints: MirrorSprint[]): MirrorNext | null {
  const active = sprints.filter((sprint) => sprint.status === 'active');
  const candidates = active.length > 0 ? active : sprints.filter((sprint) => sprint.status === 'planned');
  const source = active.length > 0 ? 'active sprint' : 'planned sprint';
  for (const sprint of candidates) {
    for (const change of sprint.changes) {
      if (change.status === 'completed' || change.status === 'done') continue;
      if (change.blockers.length > 0) continue;
      return {
        change: change.slug,
        sprint: sprint.slug,
        reason: `first pending unblocked change in ${source}`,
      };
    }
  }
  return null;
}

function hasGapSignal(change: MirrorChange): boolean {
  if (change.gaps.length > 0) return true;
  if (change.missing.length > 0) return true;
  return change.blockers.length > 0;
}
