import { describe, it, expect } from 'vitest';
import { deliveryGroupLabel, deliveryStatusLabel } from '../src/cli/status.js';

describe('deliveryGroupLabel', () => {
  it('maps the first wave to A', () => {
    expect(deliveryGroupLabel('g001')).toBe('A');
  });

  it('maps g026 to Z (end of single-letter range)', () => {
    expect(deliveryGroupLabel('g026')).toBe('Z');
  });

  it('maps g027 to AA (bijective boundary into two letters)', () => {
    expect(deliveryGroupLabel('g027')).toBe('AA');
  });

  it('maps g028 to AB', () => {
    expect(deliveryGroupLabel('g028')).toBe('AB');
  });

  it('maps g702 to ZZ (end of two-letter range)', () => {
    expect(deliveryGroupLabel('g702')).toBe('ZZ');
  });

  it('maps g703 to AAA (bijective boundary into three letters)', () => {
    expect(deliveryGroupLabel('g703')).toBe('AAA');
  });

  it('passes "!" through unchanged (unresolved blocker)', () => {
    expect(deliveryGroupLabel('!')).toBe('!');
  });

  it('passes "—" through unchanged (done/completed)', () => {
    expect(deliveryGroupLabel('—')).toBe('—');
  });

  it('returns non-gNNN input unchanged', () => {
    expect(deliveryGroupLabel('foo')).toBe('foo');
  });

  it('returns empty input unchanged', () => {
    expect(deliveryGroupLabel('')).toBe('');
  });

  it('returns input unchanged for a non-positive wave', () => {
    expect(deliveryGroupLabel('g000')).toBe('g000');
  });
});

describe('deliveryStatusLabel', () => {
  it('renders completed as archived for humans', () => {
    expect(deliveryStatusLabel('completed')).toBe('archived');
  });

  it('passes other statuses through unchanged', () => {
    expect(deliveryStatusLabel('active')).toBe('active');
  });
});
