export type CommentKind = 'line' | 'block' | 'docstring';

export interface CommentSpan {
  /** Index of the first character of the comment (inclusive). */
  start: number;
  /** Index just past the last character of the comment (exclusive). */
  end: number;
  kind: CommentKind;
  /** Raw comment text, delimiters included. */
  text: string;
}

export interface CommentCandidate extends CommentSpan {
  /** 1-based line number where the comment starts. */
  line: number;
  /** Normalized body without comment delimiters, used for detection. */
  body: string;
  /** Confidence score that this comment is AI-generated (0-100). */
  score: number;
  /** Names of the rules that matched. */
  matches: string[];
  /** True when a "keep" marker (TODO, license, lint directive...) was found. */
  protected: boolean;
}

export interface FileScanResult {
  /** Absolute path of the file. */
  path: string;
  /** Path relative to the scanned root, using POSIX separators. */
  relativePath: string;
  language: string;
  totalComments: number;
  /** Comments flagged for removal after applying the threshold. */
  removable: CommentCandidate[];
  /** Comments kept because they look human-generated or protected. */
  kept: CommentCandidate[];
  parseSkipped: boolean;
  error?: string;
}

export interface ScanSummary {
  root: string;
  filesScanned: number;
  filesWithRemovals: number;
  totalComments: number;
  removableComments: number;
  keptComments: number;
  results: FileScanResult[];
  durationMs: number;
}

export interface RemovalPreview {
  relativePath: string;
  line: number;
  kind: CommentKind;
  score: number;
  matches: string[];
  snippet: string;
}

export interface ApplyResult {
  relativePath: string;
  modified: boolean;
  removed: number;
  backupPath?: string;
}

export interface BackupManifest {
  id: string;
  createdAt: string;
  root: string;
  threshold: number;
  files: BackupRecord[];
}

export interface BackupRecord {
  relativePath: string;
  backupPath: string;
  originalHash: string;
  /** Hash of the cleaned file written after removal. */
  cleanedHash: string;
  removedComments: number;
}
