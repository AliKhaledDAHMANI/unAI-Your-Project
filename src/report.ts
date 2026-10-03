import type { ScanSummary, RemovalPreview, FileScanResult } from './types';

export interface ReportOptions {
  color: boolean;
  maxSnippetsPerFile?: number;
}

const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  cyan: '\u001b[36m',
};

function paint(text: string, code: string, enabled: boolean): string {
  return enabled ? `${code}${text}${ANSI.reset}` : text;
}

export function toPreview(file: FileScanResult, max = 5): RemovalPreview[] {
  return file.removable.slice(0, max).map((c) => ({
    relativePath: file.relativePath,
    line: c.line,
    kind: c.kind,
    score: c.score,
    matches: c.matches,
    snippet: firstLine(c.text),
  }));
}

export function renderSummary(summary: ScanSummary, options: ReportOptions): string {
  const { color, maxSnippetsPerFile = 5 } = options;
  const lines: string[] = [];
  const filesWithRemovals = summary.results.filter((r) => r.removable.length > 0);

  lines.push(paint('unAI your project — scan report', ANSI.bold, color));
  lines.push(paint(`root: ${summary.root}`, ANSI.dim, color));
  lines.push('');

  if (filesWithRemovals.length === 0) {
    lines.push(paint('No removable AI-generated comments found.', ANSI.green, color));
  }

  for (const file of filesWithRemovals) {
    lines.push(
      `${paint(file.relativePath, ANSI.cyan, color)} ${paint(
        `(${file.removable.length} of ${file.totalComments} comments)`,
        ANSI.dim,
        color,
      )}`,
    );
    for (const preview of toPreview(file, maxSnippetsPerFile)) {
      const badge = paint(`score:${preview.score}`, ANSI.yellow, color);
      const rules = paint(preview.matches.join(','), ANSI.dim, color);
      lines.push(
        `  ${paint(`L${preview.line}`, ANSI.blue, color)} ${badge} [${preview.kind}] ${rules}`,
      );
      lines.push(`      ${paint(preview.snippet, ANSI.red, color)}`);
    }
    const remaining = file.removable.length - maxSnippetsPerFile;
    if (remaining > 0) {
      lines.push(paint(`  … and ${remaining} more`, ANSI.dim, color));
    }
    lines.push('');
  }

  lines.push(paint('Summary', ANSI.bold, color));
  lines.push(`  files scanned:      ${summary.filesScanned}`);
  lines.push(`  files with matches: ${summary.filesWithRemovals}`);
  lines.push(
    `  comments found:     ${summary.totalComments} ${paint(
      `(${summary.removableComments} removable, ${summary.keptComments} kept)`,
      ANSI.dim,
      color,
    )}`,
  );
  lines.push(`  duration:           ${summary.durationMs}ms`);
  lines.push('');
  lines.push(paint('Dry-run by default — nothing was changed.', ANSI.green, color));

  return lines.join('\n');
}

export function renderApplyReport(
  summary: ScanSummary,
  applied: { relativePath: string; removed: number; backupPath?: string }[],
  backupId: string,
  color: boolean,
): string {
  const lines: string[] = [];
  lines.push(paint('unAI your project — cleanup report', ANSI.bold, color));
  lines.push(paint(`backup id: ${backupId}`, ANSI.dim, color));
  lines.push('');

  for (const file of applied) {
    lines.push(
      `${paint(file.relativePath, ANSI.cyan, color)} ${paint(
        `-${file.removed} comments`,
        ANSI.green,
        color,
      )}`,
    );
  }
  if (applied.length === 0) {
    lines.push(paint('Nothing to clean.', ANSI.green, color));
  }

  lines.push('');
  lines.push(`  files changed: ${applied.length}`);
  lines.push(`  comments removed: ${applied.reduce((s, f) => s + f.removed, 0)}`);
  lines.push(`  backup id: ${backupId}`);
  lines.push('');
  lines.push(paint(`Restore with: unai restore --id ${backupId}`, ANSI.dim, color));
  return lines.join('\n');
}

function firstLine(text: string): string {
  const line = text.split('\n')[0].trim();
  return line.length > 100 ? line.slice(0, 97) + '...' : line;
}