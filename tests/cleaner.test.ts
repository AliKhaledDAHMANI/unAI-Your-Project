import { describe, it, expect } from 'vitest';
import { removeComments, scanSource } from '../src/cleaner';
import { compileRules } from '../src/detector';
import { detectLanguage } from '../src/languages';
import { extractComments } from '../src/parser';

function clean(source: string, file: string, config = {}): string {
  const spec = detectLanguage(file)!;
  const spans = extractComments(source, spec);
  return removeComments(source, spans).content;
}

function scanAndRemove(source: string, file: string, config = {}): string {
  const spec = detectLanguage(file)!;
  const compiled = compileRules(config);
  const result = scanSource({ source, spec, relativePath: file }, compiled);
  return removeComments(
    source,
    result.removable.map((c) => ({ start: c.start, end: c.end, kind: c.kind, text: c.text })),
  ).content;
}

describe('removeComments', () => {
  it('removes a full-line comment, keeping code', () => {
    expect(clean('// gone\nconst a = 1;\n', 'a.ts')).toBe('const a = 1;\n');
  });

  it('removes a trailing comment but keeps surrounding code', () => {
    expect(clean('const a = 1; // gone\n', 'a.ts')).toBe('const a = 1;\n');
  });

  it('removes a block comment in place', () => {
    expect(clean('const /* gone */a = 1;\n', 'a.ts')).toBe('const a = 1;\n');
  });

  it('removes a multi-line standalone block comment', () => {
    const src = 'a\n/* one\n two */\nb\n';
    expect(clean(src, 'a.ts')).toBe('a\nb\n');
  });

  it('never touches string contents', () => {
    const src = 'const s = "// keep me";\n';
    expect(clean(src, 'a.ts')).toBe(src);
  });

  it('preserves CRLF line endings', () => {
    expect(clean('// gone\r\nconst a = 1;\r\n', 'a.ts')).toBe('const a = 1;\r\n');
  });

  it('keeps indentation of the following code', () => {
    expect(clean('    // gone\n    const a = 1;\n', 'a.ts')).toBe('    const a = 1;\n');
  });
});

describe('scanSource safety', () => {
  it('keeps a Python docstring that is the only statement in a block', () => {
    const src = 'def f():\n    """Only statement."""\n';
    expect(scanAndRemove(src, 'a.py')).toBe(src);
  });

  it('removes a module-level Python docstring', () => {
    const src = '"""Module."""\nimport os\n';
    expect(scanAndRemove(src, 'a.py')).toBe('import os\n');
  });

  it('removes a redundant leading comment in a function body', () => {
    const src = 'def f():\n    # This function returns the value\n    return 1\n';
    expect(scanAndRemove(src, 'a.py')).toBe('def f():\n    return 1\n');
  });

  it('flags AI comments but keeps human ones', () => {
    const spec = detectLanguage('a.ts')!;
    const src =
      '// Certainly! Here is the code\n' +
      '// the retry loop backoff is 2^n * 100ms\n';
    const result = scanSource({ source: src, spec, relativePath: 'a.ts' }, compileRules({}));
    expect(result.removable).toHaveLength(1);
    expect(result.kept).toHaveLength(1);
  });
});