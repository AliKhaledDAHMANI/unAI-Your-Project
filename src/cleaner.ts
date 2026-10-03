import { extractComments, normalizeCommentBody } from './parser';
import { detect, compileRules } from './detector';
import type { CommentCandidate, CommentSpan, ScanSummary, FileScanResult } from './types';
import type { LanguageSpec } from './languages';

export interface ScanFileInput {
  source: string;
  spec: LanguageSpec;
  relativePath: string;
}

export function scanSource(
  input: ScanFileInput,
  compiled: ReturnType<typeof compileRules>,
): FileScanResult {
  const { source, spec, relativePath } = input;
  const spans = extractComments(source, spec);
  const removable: CommentCandidate[] = [];
  const kept: CommentCandidate[] = [];

  for (const span of spans) {
    const body = normalizeCommentBody(span, spec);
    if (body.length === 0) continue;
    const result = detect(span, spec, compiled);
    const line = lineOf(source, span.start);
    const candidate: CommentCandidate = {
      ...span,
      line,
      body,
      score: result.score,
      matches: result.matches,
      protected: result.protected || isShebang(span),
    };

    const flagged = !candidate.protected && candidate.score >= compiled.threshold;
    if (flagged && wouldBreakSyntax(span, source)) {
      kept.push(candidate);
    } else if (flagged) {
      removable.push(candidate);
    } else {
      kept.push(candidate);
    }
  }

  return {
    path: '',
    relativePath,
    language: spec.id,
    totalComments: removable.length + kept.length,
    removable,
    kept,
    parseSkipped: false,
  };
}

export interface RemoveResult {
  content: string;
  removed: number;
}

export function removeComments(source: string, spans: CommentSpan[]): RemoveResult {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const n = source.length;
  let out = '';
  let cursor = 0;
  let removed = 0;

  for (const span of sorted) {
    if (span.start < cursor) continue;

    const lineStart = source.lastIndexOf('\n', span.start - 1) + 1;
    const newlineIndex = source.indexOf('\n', span.end);
    const lineEnd = newlineIndex === -1 ? n : newlineIndex;
    const prefix = source.slice(lineStart, span.start);
    const suffix = source.slice(span.end, lineEnd);
    const standalone = prefix.trim() === '' && suffix.trim() === '';

    if (standalone) {
      out += source.slice(cursor, lineStart);
      cursor = newlineIndex === -1 ? n : newlineIndex + 1;
    } else {
      let removeStart = span.start;
      while (
        removeStart > lineStart &&
        (source[removeStart - 1] === ' ' || source[removeStart - 1] === '\t')
      ) {
        removeStart--;
      }
      out += source.slice(cursor, removeStart);
      const left = removeStart > 0 ? source[removeStart - 1] : '';
      const right = span.end < n ? source[span.end] : '';
      const leftSpace = left === ' ' || left === '\t' || left === '\n' || left === '';
      const rightSpace = right === ' ' || right === '\t' || right === '\n' || right === '';
      if (!leftSpace && !rightSpace) {
        out += ' ';
      } else if (left !== '' && right === '\n') {
        out = out.replace(/[ \t]+$/, '');
      }
      cursor = span.end;
    }
    removed++;
  }

  out += source.slice(cursor);
  return { content: out, removed };
}

export function scanSummary(results: FileScanResult[], root: string, durationMs: number): ScanSummary {
  const withRemovals = results.filter((r) => r.removable.length > 0);
  return {
    root,
    filesScanned: results.length,
    filesWithRemovals: withRemovals.length,
    totalComments: results.reduce((s, r) => s + r.totalComments, 0),
    removableComments: results.reduce((s, r) => s + r.removable.length, 0),
    keptComments: results.reduce((s, r) => s + r.kept.length, 0),
    results,
    durationMs,
  };
}

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

function isShebang(span: CommentSpan): boolean {
  return span.start === 0 && span.text.startsWith('#!');
}

function wouldBreakSyntax(span: CommentSpan, source: string): boolean {
  if (span.kind !== 'docstring') return false;

  const lineStart = source.lastIndexOf('\n', span.start - 1) + 1;
  const before = source.slice(lineStart, span.start);
  const after = source.slice(span.end);
  const sameLineRest = after.slice(0, after.indexOf('\n') === -1 ? after.length : after.indexOf('\n'));

  if (before.trim() !== '') {
    return sameLineRest.replace(/#.*$/, '').trim() === '';
  }

  const docIndentCol = indentWidth(before);
  if (docIndentCol === 0) return false;

  for (const line of after.split('\n').slice(1)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const nextIndentCol = indentWidth(line.match(/^[ \t]*/)?.[0] ?? '');
    return nextIndentCol <= docIndentCol;
  }
  return true;
}

function indentationAt(source: string, index: number): string {
  const lineStart = source.lastIndexOf('\n', index - 1) + 1;
  const match = source.slice(lineStart, index).match(/^[ \t]*/);
  return match ? match[0] : '';
}

function indentWidth(indent: string): number {
  let width = 0;
  for (const ch of indent) width += ch === '\t' ? 4 : 1;
  return width;
}