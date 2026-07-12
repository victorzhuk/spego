import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'test/_cli-helpers.ts',
            'test/artifact-crud.test.ts',
            'test/cli.test.ts',
            'test/cli-help-exit.test.ts',
            'test/cli.render.test.ts',
            'test/cli.skills-command.test.ts',
            'test/cli.parity.test.ts',
            'test/containment.test.ts',
            'test/cli.epics-tasks.test.ts',
            'test/cli.gap-fill.test.ts',
            'test/delivery.test.ts',
            'test/generator.test.ts',
            'test/generator.opencode.test.ts',
            'test/helpers.ts',
            'test/init.test.ts',
            'test/package.test.ts',
            'test/revisions-and-rebuild.test.ts',
            'test/view.test.ts',
            'test/generator.workflows.test.ts',
            'test/workflows.registry.test.ts',
            'test/workflows.combined-openspec.test.ts',
            'test/workflows.review-suite.test.ts',
            'test/workflows.authoring.test.ts',
          ],
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 30,
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '.spego/**', 'coverage/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-useless-assignment': 'warn',
      'prefer-const': 'warn',
    },
  },
);
