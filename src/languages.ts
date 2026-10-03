export interface BlockSyntax {
  open: string;
  close: string;
  nested?: boolean;
}

export interface LanguageSpec {
  id: string;
  extensions: string[];
  /** Alternative file names without extension, e.g. shell scripts. */
  filenames?: string[];
  lineComment: string[];
  blockComment: BlockSyntax[];
  /** Characters that open a string literal. */
  stringDelimiters: string[];
  /** Enable Python-style triple-quoted docstring detection. */
  docstrings?: boolean;
  /** JSON is strict by default; only scan comments when explicitly enabled. */
  supportsComments?: boolean;
}

const C_STRINGS = ['"', "'"];
const JS_STRINGS = ['"', "'", '`'];

export const LANGUAGES: LanguageSpec[] = [
  {
    id: 'javascript',
    extensions: ['.js', '.mjs', '.cjs', '.jsx'],
    lineComment: ['//'],
    blockComment: [{ open: '/*', close: '*/' }],
    stringDelimiters: JS_STRINGS,
  },
  {
    id: 'typescript',
    extensions: ['.ts', '.mts', '.cts', '.tsx'],
    lineComment: ['//'],
    blockComment: [{ open: '/*', close: '*/' }],
    stringDelimiters: JS_STRINGS,
  },
  {
    id: 'python',
    extensions: ['.py', '.pyi', '.pyw'],
    lineComment: ['#'],
    blockComment: [],
    stringDelimiters: ['"', "'"],
    docstrings: true,
  },
  {
    id: 'java',
    extensions: ['.java'],
    lineComment: ['//'],
    blockComment: [{ open: '/*', close: '*/' }],
    stringDelimiters: C_STRINGS,
  },
  {
    id: 'c',
    extensions: ['.c', '.h'],
    lineComment: ['//'],
    blockComment: [{ open: '/*', close: '*/' }],
    stringDelimiters: C_STRINGS,
  },
  {
    id: 'cpp',
    extensions: ['.cc', '.cpp', '.cxx', '.c++', '.hpp', '.hh', '.hxx', '.h++'],
    lineComment: ['//'],
    blockComment: [{ open: '/*', close: '*/' }],
    stringDelimiters: C_STRINGS,
  },
  {
    id: 'csharp',
    extensions: ['.cs'],
    lineComment: ['//'],
    blockComment: [{ open: '/*', close: '*/' }],
    stringDelimiters: ['"', "'"],
  },
  {
    id: 'go',
    extensions: ['.go'],
    lineComment: ['//'],
    blockComment: [{ open: '/*', close: '*/' }],
    stringDelimiters: ['"', '`'],
  },
  {
    id: 'rust',
    extensions: ['.rs'],
    lineComment: ['//'],
    blockComment: [{ open: '/*', close: '*/', nested: true }],
    stringDelimiters: ['"'],
  },
  {
    id: 'php',
    extensions: ['.php', '.php3', '.php4', '.php5', '.phtml'],
    lineComment: ['//', '#'],
    blockComment: [{ open: '/*', close: '*/' }],
    stringDelimiters: ['"', "'"],
  },
  {
    id: 'shell',
    extensions: ['.sh', '.bash', '.zsh', '.ksh', '.fish'],
    filenames: ['.bashrc', '.zshrc', '.profile', '.bash_profile'],
    lineComment: ['#'],
    blockComment: [],
    stringDelimiters: ['"', "'"],
  },
  {
    id: 'html',
    extensions: ['.html', '.htm', '.xhtml', '.vue', '.svelte'],
    lineComment: [],
    blockComment: [{ open: '<!--', close: '-->' }],
    stringDelimiters: ['"', "'"],
  },
  {
    id: 'css',
    extensions: ['.css'],
    lineComment: [],
    blockComment: [{ open: '/*', close: '*/' }],
    stringDelimiters: ['"', "'"],
  },
  {
    id: 'scss',
    extensions: ['.scss', '.less'],
    lineComment: ['//'],
    blockComment: [{ open: '/*', close: '*/' }],
    stringDelimiters: ['"', "'"],
  },
  {
    id: 'yaml',
    extensions: ['.yml', '.yaml'],
    lineComment: ['#'],
    blockComment: [],
    stringDelimiters: ['"', "'"],
  },
  {
    id: 'markdown',
    extensions: ['.md', '.markdown', '.mdx'],
    lineComment: [],
    blockComment: [{ open: '<!--', close: '-->' }],
    stringDelimiters: [],
  },
  {
    id: 'json',
    extensions: ['.json'],
    lineComment: ['//'],
    blockComment: [{ open: '/*', close: '*/' }],
    stringDelimiters: ['"'],
    supportsComments: false,
  },
  {
    id: 'jsonc',
    extensions: ['.jsonc', '.json5'],
    lineComment: ['//'],
    blockComment: [{ open: '/*', close: '*/' }],
    stringDelimiters: ['"', "'"],
  },
];

const BY_EXTENSION = new Map<string, LanguageSpec>();
const BY_FILENAME = new Map<string, LanguageSpec>();

for (const spec of LANGUAGES) {
  for (const ext of spec.extensions) {
    BY_EXTENSION.set(ext.toLowerCase(), spec);
  }
  for (const name of spec.filenames ?? []) {
    BY_FILENAME.set(name.toLowerCase(), spec);
  }
}

export function detectLanguage(filePath: string): LanguageSpec | undefined {
  const base = filePath.split(/[\\/]/).pop() ?? filePath;
  const lower = base.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot > 0) {
    const spec = BY_EXTENSION.get(lower.slice(dot));
    if (spec) return spec;
  }
  return BY_FILENAME.get(lower);
}

export function allExtensions(): string[] {
  return [...BY_EXTENSION.keys()];
}
