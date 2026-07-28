import { describe, it, expect } from 'vitest';
import { buildProgram } from '../src/cli.js';
import { COMMAND_REGISTRY } from '../src/command-meta/registry.js';

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

  it('every registered command is in COMMAND_REGISTRY except documented plumbing', () => {
    const plumbing = new Set(['help', 'commands', 'index', 'regenerate']);
    const program = buildProgram();
    const registryNames = new Set(COMMAND_REGISTRY.map((meta) => meta.name));
    for (const cmd of program.commands) {
      if (plumbing.has(cmd.name())) continue;
      expect(registryNames.has(cmd.name()), `command '${cmd.name()}' missing from COMMAND_REGISTRY`).toBe(true);
    }
  });

  it('every COMMAND_REGISTRY entry declares both markdown and json output modes', () => {
    for (const meta of COMMAND_REGISTRY) {
      expect(meta.outputModes).toContain('markdown');
      expect(meta.outputModes).toContain('json');
    }
  });

  it('does not expose OpenCode workflow commands as spego CLI commands', () => {
    const names = new Set(COMMAND_REGISTRY.map((cmd) => cmd.name));
    expect(names.has('orchestrate')).toBe(false);
    expect(names.has('apply')).toBe(false);
    expect(names.has('verify')).toBe(false);
    expect(names.has('explore')).toBe(false);
  });

  it('every COMMAND_REGISTRY inputSchema matches the actual commander flags and positional args', () => {
    const program = buildProgram();
    const byName = new Map<string, ReturnType<typeof buildProgram>['commands'][number]>();
    for (const cmd of program.commands) byName.set(cmd.name(), cmd);

    for (const meta of COMMAND_REGISTRY) {
      const cmd = byName.get(meta.name);
      expect(cmd, `command '${meta.name}' not found on the built program`).toBeDefined();
      if (!cmd) continue;

      // --cwd is universal boilerplate; some registry entries list it and some don't. Ignore it here.
      const actualFlags = new Set(cmd.options.map((o) => o.attributeName()).filter((n) => n !== 'cwd'));
      const actualPositionals = new Set(cmd.registeredArguments.map((a) => a.name()));

      const declaredFlags = new Set(
        Object.values(meta.inputSchema)
          .filter((f) => !f.positional)
          .map((f) => f.name)
          .filter((n) => n !== 'cwd'),
      );
      const declaredPositionals = new Set(
        Object.values(meta.inputSchema).filter((f) => f.positional).map((f) => f.name),
      );

      expect([...actualFlags].sort(), `'${meta.name}' flags`).toEqual([...declaredFlags].sort());
      expect([...actualPositionals].sort(), `'${meta.name}' positional args`).toEqual(
        [...declaredPositionals].sort(),
      );
    }
  });
});
