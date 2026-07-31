/**
 * Human-facing label for a delivery status. `completed` reads as `archived`
 * — the fact that actually explains why the change is finished (archival,
 * not just task completion) — while `--json` output keeps `completed`
 * unchanged, so agents parsing the payload see no contract change.
 */
export function deliveryStatusLabel(status: string): string {
  return status === 'completed' ? 'archived' : status;
}

/**
 * Human-facing label for a delivery group wave. The `gNNN` code (`g001`,
 * `g002`, … by dependency-chain depth) renders as a bijective base-26 letter
 * sequence — `g001`→`A` … `g026`→`Z`, `g027`→`AA` — for any positive wave,
 * like a spreadsheet column. `!` (unresolved blocker) and `—` (done/completed)
 * pass through unchanged, since they already read as a label; anything that
 * doesn't parse as `gNNN` returns its input unchanged. `--json` output keeps
 * the raw `gNNN` code, so agents parsing the payload see no contract change.
 */
export function deliveryGroupLabel(group: string): string {
  if (group === '!' || group === '—') return group;
  const match = /^g(\d+)$/.exec(group);
  if (!match) return group;
  const n = Number(match[1]);
  if (!Number.isInteger(n) || n <= 0) return group;
  let letters = '';
  let m = n;
  while (m > 0) {
    m--;
    letters = String.fromCharCode(65 + (m % 26)) + letters;
    m = Math.floor(m / 26);
  }
  return letters;
}
