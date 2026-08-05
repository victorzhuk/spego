import { describe, it, expect } from 'vitest';
import { deliveryStatusLabel } from '../src/cli/status.js';

describe('deliveryStatusLabel', () => {
  it('renders completed as archived for humans', () => {
    expect(deliveryStatusLabel('completed')).toBe('archived');
  });

  it('passes other statuses through unchanged', () => {
    expect(deliveryStatusLabel('active')).toBe('active');
  });
});
