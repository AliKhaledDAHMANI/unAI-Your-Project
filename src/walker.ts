import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface WalkOptions {
  ignore: string[];
  include: string[];
}

export interface WalkedFile {
  absolutePath: string;
  relativePath: string;
}

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.ico',
  '.webp',
  '.svgz',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
  '.bz2',
  '.xz',
  '.7z',
  '.rar',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.o',
  '.a',
  '.class',
  '.jar',
  '.war',
  '.pyc',
  '.pyo',
  '.wasm',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.mp3',
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.wav',
  '.flac',
  '.sqlite',
  '.db',
  '.bin',
]);

const LOCK_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'npm-shrinkwrap.json',
  'composer.lock',
  'cargo.lock',
  'poetry.lock',
  'pipfile.lock',
  'gemfile.lock',
  'go.sum',
  'bun.lockb',
  'mix.lock',
  'packages.lock.json',
]);

export function isIgnored(relativePath: string, ignore: string[]): boolean {
  const normalized = relativePath.split(sep).join('/');
  const segments = normalized.split('/');
  for (const pattern of ignore) {
    const clean = pattern.replace(/^\/+|\/+$/g, '');
    if (!clean) continue;
    if (normalized === clean) return true;
    if (normalized.startsWith(clean + '/')) return true;
    if (segments.includes(clean)) return true;
    // Simple glob support: "build*" or "*.min.js".
    if (clean.includes('*') && globToRegExp(clean).test(normalized)) return true;
  }
  return false;
}

export function isBinaryOrLock(filePath: string): boolean {
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  const lower = base.toLowerCase();
  if (LOCK_FILES.has(lower)) return true;
  const dot = lower.lastIndexOf('.');
  if (dot >= 0 && BINARY_EXTENSIONS.has(lower.slice(dot))) return true;
  return false;
}

export function walk(root: string, options: WalkOptions): WalkedFile[] {
  const results: WalkedFile[] = [];
  const includeSet = options.include.length
    ? new Set(options.include.map((e) => (e.startsWith('.') ? e : '.' + e).toLowerCase()))
    : undefined;

  const visit = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    entries.sort();
    for (const entry of entries) {
      const absolute = join(dir, entry);
      const rel = relative(root, absolute).split(sep).join('/');
      if (isIgnored(rel, options.ignore)) continue;

      let stats;
      try {
        stats = statSync(absolute);
      } catch {
        continue;
      }

      if (stats.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!stats.isFile()) continue;
      if (isBinaryOrLock(absolute)) continue;

      if (includeSet) {
        const dot = entry.lastIndexOf('.');
        const ext = dot >= 0 ? entry.slice(dot).toLowerCase() : '';
        if (!includeSet.has(ext)) continue;
      }

      results.push({ absolutePath: absolute, relativePath: rel });
    }
  };

  visit(root);
  return results;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`(^|/)${escaped}($|/)`);
}