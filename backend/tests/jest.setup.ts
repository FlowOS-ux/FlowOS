/**
 * FlowOS backend - tests/jest.setup.ts
 * Runs once per test file BEFORE any app module is imported. env.ts validates
 * process.env at import time and exits on failure, so the required vars must exist
 * here. MONGODB_URI is a placeholder; integration tests pass the real in-memory URI
 * to connectDB(uri) directly.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test_access_secret_0123456789abcdef';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test_refresh_secret_0123456789abcdef';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/flowos-test';
