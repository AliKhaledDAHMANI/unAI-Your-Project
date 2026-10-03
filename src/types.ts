export type CommentKind = 'line' | 'block' | 'docstring';

export interface CommentSpan {
  start: number;
  end: number;
  kind: CommentKind;
  text: string;
}

export interface CommentCandidate extends CommentSpan {
  line: number;
  body: string;
  score: number;
  matches: string[];
  /** True when a "keep" marker (TODO, license, lint directive...) was found. */
  protected: boolean;
}

export interface FileScanResult {
  path: string;
  relativePath: string;
  language: string;
  totalComments: number;
  removable: CommentCandidate[];
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
  cleanedHash: string;
  removedComments: number;
}
