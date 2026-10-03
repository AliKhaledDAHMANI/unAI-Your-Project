import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface RuleConfig {
  name?: string;
  pattern: string;
  flags?: string;
  weight?: number;
  enabled?: boolean;
}

export interface DetectorConfig {
  /** Score (0-100) at or above which a comment is considered removable. */
  threshold?: number;
  /** Additional regex rules applied to normalized comment bodies. */
  rules?: RuleConfig[];
  /** Names of built-in rules to disable. */
  disabledRules?: string[];
  /** Literal substrings; a comment containing any of these is never removed. */
  protectPatterns?: string[];
  /** Comments longer than this many words get a weak AI signal. */
  maxProseWords?: number;
}

export interface UnaiConfig {
  /** Directory names or glob-like paths to ignore. */
  ignore?: string[];
  /** File extensions to include, e.g. [".ts", ".py"]. Defaults to all supported. */
  include?: string[];
  detector?: DetectorConfig;
  /** Directory (relative to root) where backups are stored. */
  backupDir?: string;
}

export const DEFAULT_IGNORE = [
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'bin',
  'obj',
  'vendor',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
  '.gradle',
  '.unai',
  'Pods',
  'DerivedData',
];

export const DEFAULT_CONFIG: Required<Omit<UnaiConfig, 'detector'>> & {
  detector: DetectorConfig;
} = {
  ignore: DEFAULT_IGNORE,
  include: [],
  detector: {
    threshold: 45,
    protectPatterns: [],
    maxProseWords: 40,
  },
  backupDir: '.unai/backups',
};

const CONFIG_FILES = ['.unairc.json', '.unairc', 'unai.config.json'];

export function loadConfig(root: string, explicitPath?: string): UnaiConfig {
  const candidates = explicitPath
    ? [resolve(root, explicitPath)]
    : CONFIG_FILES.map((f) => resolve(root, f));

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    let raw: string;
    try {
      raw = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    try {
      return JSON.parse(raw) as UnaiConfig;
    } catch (err) {
      throw new Error(`Invalid config file ${file}: ${(err as Error).message}`);
    }
  }
  return {};
}

export function resolveConfig(cliOverrides: UnaiConfig, fileConfig: UnaiConfig): {
  ignore: string[];
  include: string[];
  detector: DetectorConfig;
  backupDir: string;
} {
  const ignore = dedupe([
    ...DEFAULT_IGNORE,
    ...(fileConfig.ignore ?? []),
    ...(cliOverrides.ignore ?? []),
  ]);
  const include = cliOverrides.include?.length
    ? cliOverrides.include
    : (fileConfig.include ?? []);

  const detector: DetectorConfig = {
    ...DEFAULT_CONFIG.detector,
    ...(fileConfig.detector ?? {}),
    ...(cliOverrides.detector ?? {}),
  };

  return {
    ignore,
    include,
    detector,
    backupDir: cliOverrides.backupDir ?? fileConfig.backupDir ?? DEFAULT_CONFIG.backupDir,
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}