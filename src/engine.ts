import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectLanguage } from './languages';
import { walk } from './walker';
import { compileRules } from './detector';
import { scanSource, removeComments, scanSummary } from './cleaner';
import {
  initBackup,
  backupFile,
  writeManifest,
  findBackup,
  restoreManifest,
  listBackups,
  hashContent,
} from './backup';
import type {
  ApplyResult,
  BackupManifest,
  BackupRecord,
  FileScanResult,
  ScanSummary,
} from './types';
import type { UnaiConfig } from './config';

export interface ResolvedSettings {
  root: string;
  ignore: string[];
  include: string[];
  detector: import('./config').DetectorConfig;
  backupDir: string;
  color: boolean;
  verbose: boolean;
}

export function scanProject(settings: ResolvedSettings): ScanSummary {
  const started = Date.now();
  const compiled = compileRules(settings.detector);
  const files = walk(settings.root, { ignore: settings.ignore, include: settings.include });
  const results: FileScanResult[] = [];

  for (const file of files) {
    const spec = detectLanguage(file.absolutePath);
    if (!spec) continue;
    if (spec.supportsComments === false) continue;

    let source: string;
    try {
      source = readFileSync(file.absolutePath, 'utf8');
    } catch (err) {
      results.push({
        path: file.absolutePath,
        relativePath: file.relativePath,
        language: spec.id,
        totalComments: 0,
        removable: [],
        kept: [],
        parseSkipped: true,
        error: (err as Error).message,
      });
      continue;
    }

    if (looksBinary(source)) continue;

    const result = scanSource({ source, spec, relativePath: file.relativePath }, compiled);
    result.path = file.absolutePath;
    results.push(result);
  }

  return scanSummary(results, settings.root, Date.now() - started);
}

export interface CleanOutcome {
  summary: ScanSummary;
  applied: ApplyResult[];
  backupId: string;
}

export function cleanProject(
  settings: ResolvedSettings,
  dryRun: boolean,
): { summary: ScanSummary; outcome?: CleanOutcome } {
  const compiled = compileRules(settings.detector);
  const summary = scanProject(settings);

  if (dryRun) {
    return { summary };
  }

  const store = initBackup(settings.root, settings.backupDir);
  const applied: ApplyResult[] = [];
  const records: BackupRecord[] = [];

  for (const file of summary.results) {
    if (file.removable.length === 0) continue;
    let changed: { content: string; removed: number };
    try {
      const original = readFileSync(file.path, 'utf8');
      changed = removeComments(
        original,
        file.removable.map((c) => ({ start: c.start, end: c.end, kind: c.kind, text: c.text })),
      );
      if (changed.removed === 0) continue;
      if (changed.content.length >= original.length) continue;

      const record = backupFile(store, settings.root, file.relativePath, original);
      record.removedComments = changed.removed;
      record.cleanedHash = hashContent(changed.content);
      records.push(record);
      writeFileSync(file.path, changed.content, 'utf8');
      applied.push({
        relativePath: file.relativePath,
        modified: true,
        removed: changed.removed,
        backupPath: record.backupPath,
      });
    } catch (err) {
      applied.push({
        relativePath: file.relativePath,
        modified: false,
        removed: 0,
      });
    }
  }

  const manifest: BackupManifest = {
    id: store.id,
    createdAt: new Date().toISOString(),
    root: settings.root,
    threshold: compiled.threshold,
    files: records,
  };
  writeManifest(store, manifest);

  return {
    summary,
    outcome: { summary, applied, backupId: store.id },
  };
}

export interface RestoreOutcome {
  backupId: string;
  restored: number;
}

export function restoreProject(
  settings: ResolvedSettings,
  id?: string,
  force = false,
): RestoreOutcome {
  const manifest = findBackup(settings.root, settings.backupDir, id);
  if (!manifest) {
    throw new Error(
      id
        ? `No backup found with id "${id}".`
        : `No backups found under ${resolve(settings.root, settings.backupDir)}.`,
    );
  }
  const restored = restoreManifest(manifest, settings.root, force);
  return { backupId: manifest.id, restored };
}

export function listBackupIds(settings: ResolvedSettings): BackupManifest[] {
  return listBackups(settings.root, settings.backupDir);
}

function looksBinary(content: string): boolean {
  const sample = content.slice(0, 8000);
  if (sample.includes('\u0000')) return true;
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code < 9 || (code > 13 && code < 32)) nonPrintable++;
  }
  return nonPrintable / Math.max(1, sample.length) > 0.1;
}