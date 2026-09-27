import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// CLAUDE.md: features/ and engine/ are pure — no MediaPipe, no audio/UI
// libraries, no DOM, no Node-only APIs, no unseeded randomness.
const PURE_DIRS = ['src/features', 'src/engine']
// Matches `from 'x'`, `import 'x'` and `import('x')`.
const importOf = (spec: string) => new RegExp(`(?:from|import)\\s*\\(?\\s*['"]${spec}`)
const FORBIDDEN: readonly [RegExp, string][] = [
  [importOf('@mediapipe/'), 'MediaPipe import'],
  [importOf(`(?:tone|react|react-dom)(?:/|['"])`), 'audio/UI import'],
  [importOf('(?:node:|fs[\'"/]|path[\'"/])'), 'Node-only import'],
  [/\bMath\.random\b/, 'Math.random'],
  [/\b(window|document|navigator)\./, 'DOM global'],
]

const sources = PURE_DIRS.flatMap((dir) =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(dir, f)),
)

describe('pure layers', () => {
  it('have source files to check', () => {
    expect(sources.length).toBeGreaterThan(0)
  })

  it.each(sources)('%s imports nothing impure', (file) => {
    // Comments may mention forbidden things ("no Math.random"); only code counts.
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    for (const [pattern, what] of FORBIDDEN) expect(text, `${file}: ${what}`).not.toMatch(pattern)
  })
})
