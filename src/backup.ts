import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  cpSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import type { BackupManifest, BackupRecord } from './types';

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function createBackupId(now: Date = new Date()): string {
  return now.toISOString().replace(/[:.]/g, '-');
}

export interface BackupStore {
  id: string;
  dir: string;
}

export function initBackup(root: string, backupDir: string, now?: Date): BackupStore {
  const id = createBackupId(now);
  const dir = resolve(root, backupDir, id);
  mkdirSync(dir, { recursive: true });
  return { id, dir };
}

/**
 * Copies an original file into the backup store, preserving its relative
 * directory structure so `restore` can put it back exactly.
 */
export function backupFile(
  store: BackupStore,
  root: string,
  relativePath: string,
  originalContent: string,
): BackupRecord {
  const target = join(store.dir, 'files', relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, originalContent, 'utf8');
  return {
    relativePath: relativePath.split(sep).join('/'),
    backupPath: target,
    originalHash: hashContent(originalContent),
    cleanedHash: '',
    removedComments: 0,
  };
}

export function writeManifest(store: BackupStore, manifest: BackupManifest): void {
  writeFileSync(join(store.dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
}

export function listBackups(root: string, backupDir: string): BackupManifest[] {
  const base = resolve(root, backupDir);
  if (!existsSync(base)) return [];
  const entries = readdirSync(base).sort().reverse();
  const manifests: BackupManifest[] = [];
  for (const entry of entries) {
    const manifestPath = join(base, entry, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    try {
      manifests.push(JSON.parse(readFileSync(manifestPath, 'utf8')) as BackupManifest);
    } catch {
      // ignore corrupt manifests
    }
  }
  return manifests;
}

export function findBackup(
  root: string,
  backupDir: string,
  id?: string,
): BackupManifest | undefined {
  const backups = listBackups(root, backupDir);
  if (id) {
    const exact = backups.find((b) => b.id === id);
    if (exact) return exact;
    const matches = backups.filter((b) => b.id.startsWith(id));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new Error(`Backup id "${id}" is ambiguous (${matches.length} matches).`);
    }
    return undefined;
  }
  return backups[0];
}

export function restoreManifest(
  manifest: BackupManifest,
  root: string,
  force = false,
): number {
  let restored = 0;
  for (const record of manifest.files) {
    if (!existsSync(record.backupPath)) continue;
    const target = resolve(root, record.relativePath);
    mkdirSync(dirname(target), { recursive: true });

    if (!force && existsSync(target)) {
      const currentHash = hashContent(readFileSync(target, 'utf8'));
      // Already the original, or edited by the user since cleanup: leave it.
      if (currentHash === record.originalHash) continue;
      if (record.cleanedHash && currentHash !== record.cleanedHash) {
        throw new Error(
          `Refusing to restore ${record.relativePath}: file changed since cleanup. ` +
            `Re-run with --force to overwrite.`,
        );
      }
    }

    cpSync(record.backupPath, target);
    restored++;
  }
  return restored;
}