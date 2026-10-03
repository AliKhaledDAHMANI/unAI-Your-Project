export { detectLanguage, LANGUAGES, allExtensions } from './languages';
export type { LanguageSpec, BlockSyntax } from './languages';
export { extractComments, normalizeCommentBody } from './parser';
export { detect, compileRules } from './detector';
export { scanSource, removeComments, scanSummary } from './cleaner';
export { walk, isIgnored, isBinaryOrLock } from './walker';
export {
  loadConfig,
  resolveConfig,
  DEFAULT_CONFIG,
  DEFAULT_IGNORE,
} from './config';
export type { UnaiConfig, DetectorConfig, RuleConfig } from './config';
export {
  scanProject,
  cleanProject,
  restoreProject,
  listBackupIds,
} from './engine';
export type { ResolvedSettings, CleanOutcome, RestoreOutcome } from './engine';
export { renderSummary, renderApplyReport, toPreview } from './report';
export * from './types';