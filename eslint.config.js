import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  { ignores: ['**/node_modules/', 'client/dist/', '.history/'] },
  js.configs.recommended,
  {
    files: ['server/**/*.js', 'scripts/**/*.js', 'test/**/*.js', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['client/src/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // JSX component usage isn't tracked by the core rule
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z]' }],
    },
  },
]
