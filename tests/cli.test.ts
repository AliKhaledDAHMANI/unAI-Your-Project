import { describe, it, expect } from 'vitest';
import { parseArgs } from '../src/cli';

describe('parseArgs', () => {
  it('defaults to dry-run and the help command', () => {
    const args = parseArgs([]);
    expect(args.command).toBe('help');
    expect(args.dryRun).toBe(true);
  });

  it('parses command and path', () => {
    const args = parseArgs(['clean', 'src']);
    expect(args.command).toBe('clean');
    expect(args.root.endsWith('src')).toBe(true);
    expect(args.dryRun).toBe(true);
  });

  it('enables apply mode with --apply', () => {
    expect(parseArgs(['clean', '--apply']).dryRun).toBe(false);
  });

  it('collects repeatable options', () => {
    const args = parseArgs(['scan', '--ignore', 'a', '--ignore', 'b', '--include', '.ts']);
    expect(args.ignore).toEqual(['a', 'b']);
    expect(args.include).toEqual(['.ts']);
  });

  it('parses threshold', () => {
    expect(parseArgs(['scan', '--threshold', '70']).threshold).toBe(70);
  });

  it('parses restore id and force', () => {
    const args = parseArgs(['restore', '--id', 'abc', '--force']);
    expect(args.id).toBe('abc');
    expect(args.force).toBe(true);
  });

  it('rejects unknown options', () => {
    expect(() => parseArgs(['scan', '--nope'])).toThrow(/Unknown option/);
  });
});