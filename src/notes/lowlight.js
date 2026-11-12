import { common, createLowlight } from 'lowlight'

export const lowlight = createLowlight(common)

const ALIASES = {
  javascript: ['js', 'jsx', 'mjs', 'cjs'],
  typescript: ['ts', 'tsx'],
  xml: ['html', 'htm', 'svg', 'vue'],
  bash: ['sh', 'zsh', 'shell', 'shellscript'],
  python: ['py'],
  markdown: ['md'],
  cpp: ['cc', 'hpp', 'c++'],
  csharp: ['cs', 'c#'],
  yaml: ['yml'],
  rust: ['rs'],
  ruby: ['rb'],
  php: ['php3', 'php4', 'php5', 'php7', 'php8'],
  scss: ['sass'],
}

for (const [language, names] of Object.entries(ALIASES)) {
  for (const name of names) {
    if (lowlight.registered(name)) continue
    try {
      lowlight.registerAlias(language, name)
    } catch {
      // This alias already belongs to a grammar.
    }
  }
}
