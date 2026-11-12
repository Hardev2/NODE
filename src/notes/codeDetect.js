const CANONICAL = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  html: 'xml',
  htm: 'xml',
  svg: 'xml',
  vue: 'xml',
  md: 'markdown',
  sh: 'bash',
  zsh: 'bash',
  shell: 'bash',
  shellscript: 'bash',
  yml: 'yaml',
  rs: 'rust',
  rb: 'ruby',
  cs: 'csharp',
  'c++': 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  'c#': 'csharp',
  sass: 'scss',
  php3: 'php',
  php4: 'php',
  php5: 'php',
  php7: 'php',
  php8: 'php',
  'php-template': 'php',
}

const LABELS = {
  php: 'PHP',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  xml: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sql: 'SQL',
  json: 'JSON',
  bash: 'Bash',
  markdown: 'Markdown',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  ruby: 'Ruby',
  yaml: 'YAML',
  kotlin: 'Kotlin',
  swift: 'Swift',
  lua: 'Lua',
  diff: 'Diff',
  perl: 'Perl',
  r: 'R',
  ini: 'INI',
  graphql: 'GraphQL',
  makefile: 'Make',
  objectivec: 'Objective-C',
  wasm: 'WASM',
}

export const CODE_LANGUAGES = [
  ['php', 'PHP'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['python', 'Python'],
  ['xml', 'HTML'],
  ['css', 'CSS'],
  ['scss', 'SCSS'],
  ['sql', 'SQL'],
  ['json', 'JSON'],
  ['bash', 'Bash'],
  ['go', 'Go'],
  ['rust', 'Rust'],
  ['java', 'Java'],
  ['c', 'C'],
  ['cpp', 'C++'],
  ['csharp', 'C#'],
  ['ruby', 'Ruby'],
  ['yaml', 'YAML'],
  ['kotlin', 'Kotlin'],
  ['swift', 'Swift'],
  ['lua', 'Lua'],
  ['markdown', 'Markdown'],
]

const STRONG_LINE = [
  /^\s*<\?(php|=)?/i,
  /^\s*#!\/\S+/,
  /^\s*import\s+[\w$*{}\s,]+\s+from\s+['"]/,
  /^\s*import\s+['"][^'"]+['"]/,
  /^\s*export\s+(default\s+)?(async\s+)?(function|class|const|let|var|type|interface)\b/,
  /^\s*(export\s+)?(async\s+)?function\s*\w*\s*\(/,
  /^\s*(export\s+default\s+)?(abstract\s+)?class\s+\w+(\s+extends\s+\w+|\s+implements\s+\w+|\s*[{:(])/,
  /^\s*(public|private|protected|static)\s+(static\s+)?(function|\$?\w+)/,
  /^\s*(def|async\s+def)\s+\w+\s*\(/,
  /^\s*(const|let|var)\s+[\w$]+\s*=/,
  /^\s*#include\s*[<"]/,
  /^\s*package\s+[\w.]+\s*;/,
  /^\s*(fn|impl|struct|enum|trait)\s+\w+/,
  /^\s*pub\s+(fn|struct|enum|mod|use|trait)\b/,
  /^\s*using\s+[\w.]+\s*;/,
  /^\s*namespace\s+[\w\\]+/,
  /^\s*(SELECT|INSERT\s+INTO|UPDATE\s+\w+|DELETE\s+FROM|CREATE\s+(TABLE|DATABASE|INDEX)|ALTER\s+TABLE|WITH\s+\w+\s+AS)\b/i,
  /^\s*<!DOCTYPE\b/i,
  /^\s*<\/[A-Za-z][\w:-]*>\s*$/,
  /^\s*<[A-Za-z][\w:-]*\s+[^>]*>\s*$/,
  /^\s*@(import|media|charset|font-face|tailwind|apply)\b/,
  /^\s*\$\w+\s*(=|->)/,
  /^\s*(if|foreach|for|while|switch)\s*\([^;\n]*\)\s*\{?\s*$/,
]

export function canonicalLanguage(id) {
  if (!id) return null
  const key = String(id).trim().toLowerCase()
  if (!key || key === 'auto' || key === 'plaintext' || key === 'text' || key === 'txt') return null
  return CANONICAL[key] || key
}

export function languageLabel(id) {
  const key = canonicalLanguage(id)
  if (!key) return 'Code'
  return LABELS[key] || key
}

export function fenceParts(text) {
  const source = String(text ?? '').replace(/\r\n/g, '\n').trim()
  const match = source.match(/^```([\w#+.-]*)[ \t]*\n([\s\S]*?)\n?```$/)
  if (!match) return null
  return {
    language: canonicalLanguage(match[1]),
    code: match[2].replace(/\n+$/, ''),
  }
}

export function detectLanguage(text) {
  const source = String(text ?? '').replace(/\r\n/g, '\n')
  const head = source.trimStart()
  if (!head) return null
  if (/<\?(php|=)/i.test(source) || /\$this\b/.test(source) || /\$\w+\s*->/.test(source) || /\$\w+\s*=/.test(source)) return 'php'
  if (/^#!/.test(head)) return /python/.test(head) ? 'python' : 'bash'
  if (/^\s*[[{]/.test(head)) {
    try {
      JSON.parse(source)
      return 'json'
    } catch {
      // A leading brace is not enough on its own.
    }
  }
  if (/^\s*(SELECT|INSERT\s+INTO|UPDATE\s+\w+|DELETE\s+FROM|CREATE\s+(TABLE|DATABASE|INDEX)|ALTER\s+TABLE|WITH\s+\w+\s+AS)\b/i.test(head)) return 'sql'
  if (/^\s*from\s+\S+\s+import\b/m.test(source) || /^\s*(async\s+)?def\s+\w+\s*\(/.test(head) || /^\s*import\s+[a-z_][\w.]*\s*$/.test(head.split('\n')[0])) return 'python'
  if (/className=|<\/>|<\/?[A-Z][\w.]*/.test(source) && /\b(import|export|return|const|function)\b/.test(source)) return 'javascript'
  if (
    /^\s*import\s+[\w$*{}\s,]+\s+from\s+['"]/.test(head)
    || /^\s*import\s+['"]/.test(head)
    || /^\s*import\s+type\b/.test(head)
    || /^\s*export\s+(default\s+)?(async\s+)?(function|class|const|let|var|type|interface|enum)\b/.test(head)
    || /^\s*(export\s+)?(async\s+)?function\s*\w*\s*\(/.test(head)
    || /^\s*(const|let|var)\s+[\w$]+\s*=/.test(head)
    || (/^\s*(export\s+)?(default\s+)?class\s+\w+/.test(head) && /[{:(]|extends|implements/.test(head))
    || /^\s*(interface|type|enum)\s+\w+/.test(head)
    || (/=>/.test(source) && /[{}();]/.test(source))
  ) return 'javascript'
  if (/^\s*@(import|media|charset|font-face|tailwind|apply)\b/.test(head) || /^\s*[.#]?[\w-]+\s*\{/m.test(head)) return 'css'
  if (/^\s*<!DOCTYPE\b/i.test(head) || /^\s*<\/?[a-z][\w:-]*/i.test(head)) return 'xml'
  if (/^\s*#include\b/m.test(source) || /^\s*using\s+namespace\b/.test(head)) return 'cpp'
  if (/^\s*package\s+[\w.]+\s*;?/.test(head) && /\bfunc\s+\w+/.test(source)) return 'go'
  if (/^\s*(fn |impl |pub |struct |enum |trait |use\s+\w+::)/.test(head)) return 'rust'
  if (/^\s*(public|private|protected)\s+(class|static|void|final)\b/.test(head)) return 'java'
  return null
}

export function looksLikeCode(text) {
  const trimmed = String(text ?? '').replace(/\r\n/g, '\n').trim()
  if (trimmed.length < 4) return false
  if (/^\s*[[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed)
      return true
    } catch {
      // Keep going. A brace is not code by itself.
    }
  }
  const lines = trimmed.split('\n')
  if (STRONG_LINE.some((pattern) => pattern.test(lines[0]))) return true
  if (lines.length < 2) return false
  const symbols = trimmed.match(/[{}()[\];=<>]/g)?.length ?? 0
  if (symbols < 4) return false
  const words = trimmed.split(/\s+/).filter(Boolean).length
  if (symbols / Math.max(words, 1) < 0.4) return false
  const indented = lines.some((line) => /^[ \t]{2,}\S/.test(line))
  const marked = /=>|->|==|!=|&&|\|\||<\?|<\/|\/\*|\*\/|::|\b(function|const|let|var|return|class|import|export|def|public|SELECT|INSERT|CREATE)\b/.test(trimmed)
  return indented || marked
}
