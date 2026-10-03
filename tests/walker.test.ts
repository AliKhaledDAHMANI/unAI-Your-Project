import { describe, it, expect } from 'vitest';
import { isIgnored, isBinaryOrLock } from '../src/walker';
import { DEFAULT_IGNORE } from '../src/config';

describe('isIgnored', () => {
  it('ignores node_modules and .git at any depth', () => {
    expect(isIgnored('node_modules/foo/index.js', DEFAULT_IGNORE)).toBe(true);
    expect(isIgnored('packages/app/node_modules/x.js', DEFAULT_IGNORE)).toBe(true);
    expect(isIgnored('.git/config', DEFAULT_IGNORE)).toBe(true);
  });

  it('ignores build folders', () => {
    expect(isIgnored('dist/cli.js', DEFAULT_IGNORE)).toBe(true);
    expect(isIgnored('build/out.o', DEFAULT_IGNORE)).toBe(true);
  });

  it('supports custom glob patterns', () => {
    expect(isIgnored('src/a.min.js', ['*.min.js'])).toBe(true);
    expect(isIgnored('generated/v1/x.ts', ['generated*'])).toBe(true);
  });

  it('does not ignore normal source files', () => {
    expect(isIgnored('src/index.ts', DEFAULT_IGNORE)).toBe(false);
  });
});

describe('isBinaryOrLock', () => {
  it('detects binary extensions', () => {
    expect(isBinaryOrLock('a.png')).toBe(true);
    expect(isBinaryOrLock('a.exe')).toBe(true);
  });

  it('detects lock files case-insensitively', () => {
    expect(isBinaryOrLock('package-lock.json')).toBe(true);
    expect(isBinaryOrLock('Cargo.lock')).toBe(true);
  });

  it('allows normal source', () => {
    expect(isBinaryOrLock('src/index.ts')).toBe(false);
  });
});