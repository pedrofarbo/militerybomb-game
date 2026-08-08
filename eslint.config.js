import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'src/assets/*.generated.ts', 'coverage/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  /**
   * A DECISÃO ARQUITETURAL MAIS IMPORTANTE DO PROJETO, aplicada por lint.
   *
   * `src/core` é a camada de regras: precisa rodar em Node, sem canvas, sem
   * WebGL e sem DOM, para que todo teste unitário seja barato. No dia em que
   * um import de Phaser entrar aqui, a testabilidade acaba silenciosamente.
   * Então o CI quebra em vez de deixar acontecer.
   */
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'phaser',
              message:
                'src/core deve permanecer livre de Phaser. Regras de jogo aqui; ' +
                'sprites, corpos e cenas em src/game.',
            },
          ],
          patterns: [
            {
              group: ['phaser/*', '**/game/**', '**/ui/**'],
              message:
                'src/core não pode depender das camadas de apresentação. ' +
                'Inverta a dependência: exponha um tipo e deixe game/ui consumirem.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'src/core roda em Node nos testes: sem DOM.' },
        { name: 'document', message: 'src/core roda em Node nos testes: sem DOM.' },
        { name: 'localStorage', message: 'Use a interface SaveRepository.' },
      ],
    },
  },

  {
    files: ['tools/**/*.mjs', '*.config.ts', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },

  { files: ['tests/**/*.ts'], languageOptions: { globals: { ...globals.node } } },
);
