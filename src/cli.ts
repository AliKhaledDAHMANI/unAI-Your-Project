#!/usr/bin/env node
import { resolve } from 'node:path';
import { stdout, stderr } from 'node:process';
import { loadConfig, resolveConfig, type UnaiConfig } from './config';
import { scanProject, cleanProject, restoreProject, listBackupIds } from './engine';
import type { ResolvedSettings } from './engine';
import { renderSummary, renderApplyReport } from './report';

const VERSION = '1.0.0';

interface ParsedArgs {
  command: string;
  root: string;
  dryRun: boolean;
  color: boolean;
  verbose: boolean;
  id?: string;
  config?: string;
  threshold?: number;
  ignore: string[];
  include: string[];
  json: boolean;
  force: boolean;
}

const HELP = `unAI your project v${VERSION}

Safely remove unnecessary AI-generated comments, explanations and docstrings.

Usage:
  unai scan    [path] [options]   Scan and report removable comments (no changes)
  unai clean   [path] [options]   Remove flagged comments (dry-run unless --apply)
  unai restore [path] [options]   Restore files from a backup

Options:
  --apply              Actually write changes (clean defaults to dry-run)
  --dry-run            Force report-only mode
  --id <id>            Backup id to restore (defaults to the latest)
  --force              On restore, overwrite files changed since cleanup
  --threshold <n>      Removal confidence threshold 0-100 (default 45)
  --ignore <path>      Additional path to ignore (repeatable)
  --include <ext>      Only process these extensions, e.g. .ts (repeatable)
  --config <file>      Path to a config file (default .unairc.json)
  --json               Output the scan summary as JSON
  --no-color           Disable ANSI colors
  --verbose            Show extra detail
  --version, -v        Print version
  --help, -h           Show this help

Examples:
  unai scan .
  unai clean src --threshold 60
  unai clean . --apply
  unai restore --id 2026-01-01T10-00-00-000Z
`;

export function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const parsed: ParsedArgs = {
    command: '',
    root: process.cwd(),
    dryRun: true,
    color: stdout.isTTY === true,
    verbose: false,
    ignore: [],
    include: [],
    json: false,
    force: false,
  };

  const positionals: string[] = [];
  while (args.length > 0) {
    const arg = args.shift()!;
    switch (arg) {
      case '--apply':
        parsed.dryRun = false;
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
      case '--id':
        parsed.id = args.shift();
        break;
      case '--threshold': {
        const value = Number(args.shift());
        if (Number.isFinite(value)) parsed.threshold = value;
        break;
      }
      case '--ignore':
        if (args[0]) parsed.ignore.push(args.shift()!);
        break;
      case '--include':
        if (args[0]) parsed.include.push(args.shift()!);
        break;
      case '--config':
        parsed.config = args.shift();
        break;
      case '--json':
        parsed.json = true;
        break;
      case '--no-color':
        parsed.color = false;
        break;
      case '--verbose':
        parsed.verbose = true;
        break;
      case '--force':
        parsed.force = true;
        break;
      case '--version':
      case '-v':
        parsed.command = 'version';
        break;
      case '--help':
      case '-h':
        parsed.command = 'help';
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        positionals.push(arg);
    }
  }

  if (!parsed.command) parsed.command = positionals.shift() ?? 'help';
  if (positionals.length > 0) parsed.root = resolve(positionals[0]);
  return parsed;
}

function buildSettings(parsed: ParsedArgs): ResolvedSettings {
  const fileConfig = loadConfig(parsed.root, parsed.config);
  const overrides: UnaiConfig = {
    ignore: parsed.ignore,
    include: parsed.include,
  };
  if (parsed.threshold !== undefined) {
    overrides.detector = { threshold: parsed.threshold };
  }
  const resolved = resolveConfig(overrides, fileConfig);
  return {
    root: parsed.root,
    ignore: resolved.ignore,
    include: resolved.include,
    detector: resolved.detector,
    backupDir: resolved.backupDir,
    color: parsed.color,
    verbose: parsed.verbose,
  };
}

export function run(argv: string[] = process.argv.slice(2)): number {
  const parsed = parseArgs(argv);

  switch (parsed.command) {
    case 'help':
      stdout.write(HELP);
      return 0;

    case 'version':
      stdout.write(`${VERSION}\n`);
      return 0;

    case 'scan': {
      const settings = buildSettings(parsed);
      const summary = scanProject(settings);
      if (parsed.json) {
        const minimal = {
          root: summary.root,
          filesScanned: summary.filesScanned,
          filesWithRemovals: summary.filesWithRemovals,
          totalComments: summary.totalComments,
          removableComments: summary.removableComments,
          keptComments: summary.keptComments,
          results: summary.results
            .filter((r) => r.removable.length > 0)
            .map((r) => ({
              path: r.relativePath,
              language: r.language,
              removable: r.removable.length,
              comments: r.removable.map((c) => ({
                line: c.line,
                kind: c.kind,
                score: c.score,
                rules: c.matches,
              })),
            })),
        };
        stdout.write(JSON.stringify(minimal, null, 2) + '\n');
      } else {
        stdout.write(renderSummary(summary, { color: settings.color }) + '\n');
      }
      return summary.removableComments > 0 ? 1 : 0;
    }

    case 'clean': {
      const settings = buildSettings(parsed);
      if (parsed.dryRun) {
        const { summary } = cleanProject(settings, true);
        stdout.write(renderSummary(summary, { color: settings.color }) + '\n');
        return summary.removableComments > 0 ? 1 : 0;
      }
      const { outcome } = cleanProject(settings, false);
      if (!outcome) return 0;
      if (parsed.json) {
        stdout.write(
          JSON.stringify(
            {
              backupId: outcome.backupId,
              filesChanged: outcome.applied.filter((a) => a.modified).length,
              commentsRemoved: outcome.applied.reduce((s, a) => s + a.removed, 0),
              files: outcome.applied,
            },
            null,
            2,
          ) + '\n',
        );
      } else {
        stdout.write(
          renderApplyReport(outcome.summary, outcome.applied, outcome.backupId, settings.color) +
            '\n',
        );
      }
      return 0;
    }

    case 'restore': {
      const settings = buildSettings(parsed);
      const result = restoreProject(settings, parsed.id, parsed.force);
      stdout.write(
        `Restored ${result.restored} file(s) from backup ${result.backupId}.\n`,
      );
      return 0;
    }

    case 'backups': {
      const settings = buildSettings(parsed);
      const backups = listBackupIds(settings);
      if (backups.length === 0) {
        stdout.write('No backups found.\n');
      } else {
        for (const b of backups) {
          stdout.write(`${b.id}  ${b.createdAt}  ${b.files.length} file(s)\n`);
        }
      }
      return 0;
    }

    default:
      stderr.write(`Unknown command: ${parsed.command}\n\n${HELP}`);
      return 2;
  }
}

/* c8 ignore next 4 */
if (require.main === module) {
  try {
    process.exitCode = run();
  } catch (err) {
    stderr.write(`error: ${(err as Error).message}\n`);
    process.exitCode = 2;
  }
}