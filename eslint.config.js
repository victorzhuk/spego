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
            'test/artifact-crud.test.ts',
            'test/cli.test.ts',
            'test/delivery.test.ts',
            'test/generator.test.ts',
            'test/helpers.ts',
            'test/init.test.ts',
            'test/package.test.ts',
            'test/revisions-and-rebuild.test.ts',
            'test/view.test.ts',
            'test/generator.workflows.test.ts',
            'test/workflows.registry.test.ts',
            'test/workflows.review-suite.test.ts',
          ],
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
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
