/**
 * Human-facing label for a delivery status. `completed` reads as `archived`
 * — the fact that actually explains why the change is finished (archival,
 * not just task completion) — while `--json` output keeps `completed`
 * unchanged, so agents parsing the payload see no contract change.
 */
export function deliveryStatusLabel(status: string): string {
  return status === 'completed' ? 'archived' : status;
}
