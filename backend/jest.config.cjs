/**
 * FlowOS backend - Jest config.
 * The source is TypeScript with NodeNext-style ".js" import specifiers but runs as
 * CommonJS at runtime (no "type":"module"). We therefore:
 *  - transpile with ts-jest in isolatedModules mode (fast, no cross-file type errors;
 *    full type-checking stays in `npm run typecheck`),
 *  - strip ".js" from relative imports so they resolve to the ".ts" sources,
 *  - set required env in setupFiles BEFORE app code (env.ts validates at import time).
 */

// Newer TypeScript than ts-jest officially lists — skip the version gate.
process.env.TS_JEST_DISABLE_VER_CHECKER = '1';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFiles: ['<rootDir>/tests/jest.setup.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  testTimeout: 30000,
  clearMocks: true,
};
