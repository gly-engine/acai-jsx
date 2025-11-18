import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ["src/*.tsx"],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/strict-boolean-expressions': 'error',
      'eqeqeq': ['error', 'always']
    },
  }
);
