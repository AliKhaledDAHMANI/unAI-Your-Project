import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanProject, cleanProject, restoreProject } from '../src/engine';
import type { ResolvedSettings } from '../src/engine';

function settings(root: string, detector = {}): ResolvedSettings {
  return {
    root,
    ignore: ['node_modules', '.git'],
    include: [],
    detector,
    backupDir: '.unai/backups',
    color: false,
    verbose: false,
  };
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'unai-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(rel: string, content: string) {
  const target = join(root, rel);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, content, 'utf8');
}

describe('scanProject', () => {
  it('scans supported files and skips ignored folders', () => {
    write('src/a.ts', '// Certainly! Here is the code\nconst a = 1;\n');
    write('src/b.py', '"""Module doc."""\n# As an AI language model, I suggest\nx = 1\n');
    write('node_modules/pkg/index.js', '// Certainly! ignore me\n');
    write('README.md', '# Title\n');

    const summary = scanProject(settings(root));
    const files = summary.results.map((r) => r.relativePath);
    expect(files).toContain('src/a.ts');
    expect(files).toContain('src/b.py');
    expect(files).not.toContain('node_modules/pkg/index.js');
    expect(summary.removableComments).toBeGreaterThanOrEqual(2);
  });

  it('does not scan strict JSON comments by default', () => {
    write('tsconfig.json', '// not really json\n{ "a": 1 }\n');
    const summary = scanProject(settings(root));
    expect(summary.results.find((r) => r.relativePath === 'tsconfig.json')).toBeUndefined();
  });

  it('scans JSONC comments', () => {
    write('tsconfig.jsonc', '// Certainly! Here is the config\n{ "a": 1 }\n');
    const summary = scanProject(settings(root));
    const result = summary.results.find((r) => r.relativePath === 'tsconfig.jsonc');
    expect(result).toBeDefined();
    expect(result!.removable).toHaveLength(1);
  });
});

describe('cleanProject + restoreProject', () => {
  it('removes flagged comments, creates a backup, and restores', () => {
    const original = '// Certainly! Here is the implementation\nconst a = 1;\n';
    write('src/a.ts', original);

    const { outcome } = cleanProject(settings(root), false);
    expect(outcome).toBeDefined();
    expect(outcome!.applied[0].removed).toBe(1);

    const afterClean = readFileSync(join(root, 'src/a.ts'), 'utf8');
    expect(afterClean).toBe('const a = 1;\n');

    const restored = restoreProject(settings(root), outcome!.backupId, true);
    expect(restored.restored).toBe(1);
    expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(original);
  });

  it('dry-run does not modify files or create backups', () => {
    write('src/a.ts', '// Certainly! Here is the implementation\nconst a = 1;\n');
    const { outcome } = cleanProject(settings(root), true);
    expect(outcome).toBeUndefined();
    expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toContain('Certainly');
  });

  it('never changes code logic or strings', () => {
    const src =
      '// Certainly! explanation\n' +
      'const s = "Certainly! keep this string";\n' +
      'export function f() { return s.length; }\n';
    write('src/a.ts', src);
    cleanProject(settings(root), false);
    const after = readFileSync(join(root, 'src/a.ts'), 'utf8');
    expect(after).toContain('const s = "Certainly! keep this string";');
    expect(after).toContain('export function f() { return s.length; }');
    expect(after.startsWith('//')).toBe(false);
  });

  it('refuses to restore a file edited after cleanup unless forced', () => {
    const original = '// Certainly! Here is the implementation\nconst a = 1;\n';
    write('src/a.ts', original);
    const { outcome } = cleanProject(settings(root), false);
    write('src/a.ts', 'const a = 2;\n');
    expect(() => restoreProject(settings(root), outcome!.backupId, false)).toThrow();
  });
});