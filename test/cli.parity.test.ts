import { describe, it, expect } from 'vitest';
import { buildProgram } from '../src/cli.js';
import { COMMAND_REGISTRY } from '../src/commands/registry.js';

describe('CLI registry/program parity', () => {
  it('every COMMAND_REGISTRY entry maps to a registered Commander command', () => {
    const program = buildProgram();
    const registered = new Set<string>();
    for (const cmd of program.commands) {
      registered.add(cmd.name());
      for (const sub of cmd.commands) {
        registered.add(`${cmd.name()} ${sub.name()}`);
      }
    }
    for (const meta of COMMAND_REGISTRY) {
      expect(registered.has(meta.name)).toBe(true);
    }
  });

  it('every COMMAND_REGISTRY entry declares both markdown and json output modes', () => {
    for (const meta of COMMAND_REGISTRY) {
      expect(meta.outputModes).toContain('markdown');
      expect(meta.outputModes).toContain('json');
    }
  });
});
