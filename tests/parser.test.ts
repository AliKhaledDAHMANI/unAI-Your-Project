import { describe, it, expect } from 'vitest';
import { extractComments, normalizeCommentBody } from '../src/parser';
import { detectLanguage } from '../src/languages';

function comments(source: string, file: string) {
  const spec = detectLanguage(file)!;
  return extractComments(source, spec);
}

describe('extractComments — JavaScript/TypeScript', () => {
  it('finds line and block comments', () => {
    const src = `// line\nconst a = 1; /* block */\n`;
    const found = comments(src, 'a.ts');
    expect(found.map((c) => c.kind)).toEqual(['line', 'block']);
  });

  it('ignores comment markers inside strings', () => {
    const src = `const url = "http://example.com/path"; // real comment\n`;
    const found = comments(src, 'a.ts');
    expect(found).toHaveLength(1);
    expect(found[0].text).toBe('// real comment');
  });

  it('ignores markers inside template literals and handles interpolation', () => {
    const src = 'const s = `a // not a comment ${"/* nope */"} b`; // yes\n';
    const found = comments(src, 'a.ts');
    expect(found).toHaveLength(1);
    expect(found[0].text).toContain('yes');
  });

  it('handles escaped quotes', () => {
    const src = `const s = "she said \\"//hi\\""; // comment\n`;
    const found = comments(src, 'a.ts');
    expect(found).toHaveLength(1);
  });

  it('does not treat regex-looking division as a comment', () => {
    const src = `const x = 10 / 2; // divide\n`;
    const found = comments(src, 'a.ts');
    expect(found).toHaveLength(1);
  });
});

describe('extractComments — Python', () => {
  it('finds hash comments and module docstrings', () => {
    const src = `"""Module doc."""\n# comment\nx = 1\n`;
    const found = comments(src, 'a.py');
    expect(found.map((c) => c.kind)).toEqual(['docstring', 'line']);
  });

  it('treats triple-quoted data as a string, not a comment', () => {
    const src = `x = """\n /* not a comment */\n"""\n`;
    const found = comments(src, 'a.py');
    expect(found).toHaveLength(0);
  });

  it('does not confuse a single-quoted string containing a hash', () => {
    const src = `s = "# not a comment"\n# real\n`;
    const found = comments(src, 'a.py');
    expect(found).toHaveLength(1);
    expect(found[0].text).toBe('# real');
  });
});

describe('extractComments — other languages', () => {
  it('parses HTML comments', () => {
    const found = comments(`<div><!-- hi --></div>\n`, 'a.html');
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe('block');
  });

  it('parses YAML comments but not hashes in quoted scalars', () => {
    const found = comments(`key: "a # b" # real\n`, 'a.yaml');
    expect(found).toHaveLength(1);
    expect(found[0].text).toBe('# real');
  });

  it('parses Rust nested block comments', () => {
    const found = comments(`/* outer /* inner */ still outer */\n`, 'a.rs');
    expect(found).toHaveLength(1);
    expect(found[0].text).toContain('still outer');
  });

  it('does not parse C block comment markers inside strings', () => {
    const found = comments(`char *s = "/* not */"; /* yes */\n`, 'a.c');
    expect(found).toHaveLength(1);
  });
});

describe('normalizeCommentBody', () => {
  it('strips line prefixes', () => {
    const spec = detectLanguage('a.ts')!;
    const [span] = extractComments('// hello world', spec);
    expect(normalizeCommentBody(span, spec)).toBe('hello world');
  });

  it('strips block decorations', () => {
    const spec = detectLanguage('a.ts')!;
    const [span] = extractComments('/**\n * hello\n * world\n */', spec);
    expect(normalizeCommentBody(span, spec)).toBe('hello\nworld');
  });
});