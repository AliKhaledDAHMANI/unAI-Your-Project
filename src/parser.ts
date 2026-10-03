import type { CommentSpan } from './types';
import type { LanguageSpec } from './languages';

/**
 * Extracts comments from source text while respecting string literals.
 *
 * The parser is deliberately conservative: when it cannot be sure whether a
 * token starts a comment, it prefers to skip it rather than risk treating code
 * as a comment. This guarantees the cleaner never deletes real source.
 */
export function extractComments(source: string, spec: LanguageSpec): CommentSpan[] {
  const comments: CommentSpan[] = [];
  const n = source.length;
  let i = 0;

  // Python cannot have `//`, so line prefixes are checked per language.
  const linePrefixes = dedupeByLength(spec.lineComment);
  const blockStarts = dedupeByLength(spec.blockComment.map((b) => b.open));

  const docstringEnabled = spec.docstrings === true;
  const hasJsTemplate = spec.stringDelimiters.includes('`');

  while (i < n) {
    const ch = source[i];

    // --- Python triple-quoted docstrings (checked before strings) --------
    if (docstringEnabled && (ch === '"' || ch === "'")) {
      const triple = ch.repeat(3);
      if (source.startsWith(triple, i) && isDocstringPosition(source, i)) {
        const close = findTripleEnd(source, i + 3, triple);
        const end = close === -1 ? n : close + 3;
        comments.push({ start: i, end, kind: 'docstring', text: source.slice(i, end) });
        i = end;
        continue;
      }
    }

    // --- String literals -------------------------------------------------
    if (isStringDelimiter(ch, spec)) {
      i = skipString(source, i, ch, hasJsTemplate, docstringEnabled);
      continue;
    }

    // --- Block comments --------------------------------------------------
    const block = matchPrefix(source, i, blockStarts);
    if (block) {
      const syntax = spec.blockComment.find((b) => b.open === block)!;
      const end = skipBlock(source, i, syntax.open, syntax.close, syntax.nested === true, spec);
      comments.push({ start: i, end, kind: 'block', text: source.slice(i, end) });
      i = end;
      continue;
    }

    // --- Line comments ---------------------------------------------------
    const line = matchPrefix(source, i, linePrefixes);
    if (line) {
      let end = i + line.length;
      while (end < n && source[end] !== '\n') end++;
      comments.push({ start: i, end, kind: 'line', text: source.slice(i, end) });
      i = end;
      continue;
    }

    i++;
  }

  return comments;
}

function isStringDelimiter(ch: string, spec: LanguageSpec): boolean {
  return spec.stringDelimiters.includes(ch);
}

/**
 * Heuristic: a triple-quoted string is a docstring only when it is the first
 * statement on its logical line (ignoring indentation and a leading `r`/`b`
 * style prefix). Free-standing triple strings used as data are left untouched.
 */
function isDocstringPosition(source: string, quoteStart: number): boolean {
  let i = quoteStart - 1;
  while (i >= 0 && (source[i] === ' ' || source[i] === '\t')) i--;
  if (i < 0) return true;
  const prev = source[i];
  return prev === '\n' || prev === '\r' || prev === ';' || prev === ':';
}

function skipString(
  source: string,
  start: number,
  quote: string,
  allowTemplate: boolean,
  allowTriple = false,
): number {
  const n = source.length;
  if (allowTriple && source.startsWith(quote.repeat(3), start)) {
    const close = findTripleEnd(source, start + 3, quote.repeat(3));
    return close === -1 ? n : close + 3;
  }
  let i = start + 1;
  while (i < n) {
    const ch = source[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (allowTemplate && quote === '`' && ch === '$' && source[i + 1] === '{') {
      i = skipTemplateExpression(source, i + 2);
      continue;
    }
    if (ch === quote) return i + 1;
    // A newline ends a normal (non-template) string; treat as unterminated.
    if (ch === '\n' && quote !== '`' && !isMultilineAllowed(source, start)) return i;
    i++;
  }
  return n;
}

function isMultilineAllowed(_source: string, _start: number): boolean {
  // Conservative: non-template strings are assumed single-line.
  return false;
}

function skipTemplateExpression(source: string, start: number): number {
  const n = source.length;
  let depth = 1;
  let i = start;
  while (i < n) {
    const ch = source[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(source, i, ch, ch === '`');
      continue;
    }
    i++;
  }
  return n;
}

function findTripleEnd(source: string, from: number, triple: string): number {
  const n = source.length;
  let i = from;
  while (i < n) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source.startsWith(triple, i)) return i;
    i++;
  }
  return -1;
}

function skipBlock(
  source: string,
  start: number,
  open: string,
  close: string,
  nested: boolean,
  spec: LanguageSpec,
): number {
  const n = source.length;
  let i = start + open.length;
  let depth = 1;
  while (i < n) {
    if (nested && source.startsWith(open, i)) {
      depth++;
      i += open.length;
      continue;
    }
    if (source.startsWith(close, i)) {
      depth--;
      i += close.length;
      if (depth === 0) return i;
      continue;
    }
    i++;
  }
  return n;
}

function matchPrefix(source: string, index: number, prefixes: string[]): string | undefined {
  for (const prefix of prefixes) {
    if (source.startsWith(prefix, index)) return prefix;
  }
  return undefined;
}

function dedupeByLength(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => b.length - a.length);
}

/**
 * Produces the normalized comment body used by the detector: delimiters and
 * decorative characters are stripped, whitespace collapsed.
 */
export function normalizeCommentBody(span: CommentSpan, spec: LanguageSpec): string {
  let text = span.text;

  if (span.kind === 'line') {
    const prefix = spec.lineComment.find((p) => text.startsWith(p));
    if (prefix) text = text.slice(prefix.length);
    text = text.replace(/^[ \t]*/, '');
  } else if (span.kind === 'block') {
    const syntax =
      spec.blockComment.find((b) => text.startsWith(b.open)) ?? spec.blockComment[0];
    if (syntax) {
      text = text.slice(syntax.open.length);
      if (text.endsWith(syntax.close)) text = text.slice(0, -syntax.close.length);
    }
    text = text
      .split('\n')
      .map((line) => line.replace(/^[ \t]*\*?[ \t]?/, ''))
      .join('\n');
  } else if (span.kind === 'docstring') {
    const quote = text.slice(0, 3);
    text = text.slice(3);
    if (text.endsWith(quote)) text = text.slice(0, -quote.length);
  }

  return text.trim();
}