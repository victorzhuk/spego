#!/usr/bin/env node
/**
 * calibrate-seed — derive the first flows seed from sessions already on disk.
 *
 * One-off calibration scaffolding, not product code: it reads a vendor-specific
 * session format (Claude Code JSONL transcripts) and joins sessions to archived
 * OpenSpec changes by time window and branch. The join is heuristic — review
 * the printed per-change attributions before trusting any aggregate.
 *
 * Usage:
 *   node scripts/calibrate-seed.mjs [--sessions-dir <dir>] [--repo <dir>]
 *                                   [--tiers slug=tier[,slug=tier...]] [--profile <name>]
 *
 * Without --tiers it prints the per-change table and caveats only. With
 * --tiers it additionally prints a flows block whose profile holds the median
 * attributed hours per Size Tier, ready to paste into .spego/config.yaml
 * (after filling every tier marked TODO — a profile missing a tier fails
 * config validation, and so does a flows block without a human table).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SIZE_TIERS = ['xs', 's', 'm', 'l', 'xl'];

function parseArgs(argv) {
  const opts = {
    sessionsDir: path.join(os.homedir(), '.claude', 'projects', '-home-zhuk-Projects-own-spego'),
    repo: process.cwd(),
    tiers: null,
    profile: 'zapply',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--sessions-dir') opts.sessionsDir = argv[++i];
    else if (arg === '--repo') opts.repo = argv[++i];
    else if (arg === '--profile') opts.profile = argv[++i];
    else if (arg === '--tiers') {
      opts.tiers = new Map();
      for (const pair of argv[++i].split(',')) {
        const [slug, tier] = pair.split('=');
        if (!slug || !SIZE_TIERS.includes(tier)) {
          throw new Error(`Bad --tiers entry "${pair}" — expected slug=${SIZE_TIERS.join('|')}`);
        }
        opts.tiers.set(slug, tier);
      }
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function readSessions(sessionsDir) {
  const sessions = [];
  for (const name of fs.readdirSync(sessionsDir).filter((n) => n.endsWith('.jsonl'))) {
    let start = null;
    let end = null;
    const branches = new Map();
    for (const line of fs.readFileSync(path.join(sessionsDir, name), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof rec.timestamp === 'string') {
        const time = new Date(rec.timestamp).getTime();
        if (Number.isFinite(time)) {
          if (start === null || time < start) start = time;
          if (end === null || time > end) end = time;
        }
      }
      if (typeof rec.gitBranch === 'string' && rec.gitBranch.length > 0) {
        branches.set(rec.gitBranch, (branches.get(rec.gitBranch) ?? 0) + 1);
      }
    }
    if (start === null) continue;
    const branch = [...branches.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    sessions.push({ id: name.replace(/\.jsonl$/, ''), start, end, branch });
  }
  return sessions.sort((a, b) => a.start - b.start);
}

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

function readChangeWindows(repo) {
  const archiveDir = path.join(repo, 'openspec', 'changes', 'archive');
  const windows = [];
  for (const entry of fs.readdirSync(archiveDir)) {
    const slug = entry.replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const archivedAt = git(repo, ['log', '-1', '--format=%aI', '--', `openspec/changes/archive/${entry}`]);
    const createdAt = git(repo, ['log', '--reverse', '--format=%aI', '--', `openspec/changes/${slug}/`]).split('\n')[0] ?? '';
    const start = Date.parse(createdAt) || Date.parse(archivedAt);
    const end = Date.parse(archivedAt);
    if (!Number.isFinite(end)) continue;
    windows.push({ slug, start, end, sessions: [] });
  }
  return windows.sort((a, b) => a.start - b.start);
}

function attribute(sessions, windows) {
  const skipped = [];
  let shared = 0;
  for (const session of sessions) {
    const candidates = windows.filter(
      (w) => session.start <= w.end && session.end >= w.start && (session.branch === null || session.branch === 'master'),
    );
    if (candidates.length === 0) {
      skipped.push(session);
      continue;
    }
    if (candidates.length > 1) shared += 1;
    for (const w of candidates) w.sessions.push(session);
  }
  return { skipped, shared };
}

function hours(session) {
  return (session.end - session.start) / 3_600_000;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 100) / 100;
}

function fmtDate(time) {
  return new Date(time).toISOString().slice(0, 10);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sessions = readSessions(opts.sessionsDir);
  const windows = readChangeWindows(opts.repo);
  const { skipped, shared } = attribute(sessions, windows);

  console.log('# Per-change attribution (review before trusting any aggregate)');
  console.log('');
  const priced = [];
  for (const w of windows) {
    if (w.sessions.length === 0) continue;
    const total = Math.round(w.sessions.reduce((sum, s) => sum + hours(s), 0) * 100) / 100;
    const days = new Set(w.sessions.flatMap((s) => [fmtDate(s.start), fmtDate(s.end)]));
    const tier = opts.tiers?.get(w.slug);
    const ids = new Set(w.sessions.map((s) => s.id));
    priced.push({ ...w, total, tier });
    console.log(
      `${w.slug}  sessions=${ids.size}  hours=${total}` +
        `${tier ? `  tier=${tier}` : ''}${days.size > 1 ? '  (sessions split across days)' : ''}`,
    );
  }
  console.log('');

  const sessionFloor = sessions.length > 0 ? fmtDate(sessions[0].start) : 'n/a';
  const unpriced = windows.filter((w) => w.sessions.length === 0);
  console.log('# Coverage caveats');
  console.log(`- earliest recorded session: ${sessionFloor} — changes closed before then have no data`);
  console.log(`- ${unpriced.length} of ${windows.length} archived changes have no attributable session`);
  console.log(`- ${skipped.length} of ${sessions.length} sessions left out (no overlapping change window; never forced onto a neighbour)`);
  console.log(`- ${shared} sessions overlap several open changes and count toward each — the join prices calendar time per change, not exclusive effort`);
  console.log('- hours are elapsed wall-clock per session, including any idle gaps inside a session');
  console.log('');

  if (!opts.tiers) {
    console.log('Re-run with --tiers slug=tier,... to print the flows block.');
    return;
  }

  const hoursByTier = new Map();
  for (const row of priced) {
    if (!row.tier) continue;
    hoursByTier.set(row.tier, [...(hoursByTier.get(row.tier) ?? []), row.total]);
  }
  const missing = SIZE_TIERS.filter((tier) => !hoursByTier.has(tier));
  console.log('# flows block — paste into .spego/config.yaml');
  console.log('flows:');
  console.log(`  default: ${opts.profile}`);
  console.log('  profiles:');
  console.log(`    ${opts.profile}:`);
  for (const tier of SIZE_TIERS) {
    const values = hoursByTier.get(tier);
    console.log(values ? `      ${tier}: ${median(values)}` : `      ${tier}: 0  # TODO: no measured change at this tier`);
  }
  console.log('  human:  # TODO: human hours are not measurable from agent sessions');
  for (const tier of SIZE_TIERS) console.log(`    ${tier}: 0  # TODO`);
  if (missing.length > 0) {
    console.log('');
    console.log(`# WARNING: tiers with no measured change: ${missing.join(', ')} — the profile fails validation until every tier is filled`);
  }
}

main();
