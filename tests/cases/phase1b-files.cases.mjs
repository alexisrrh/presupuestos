import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../../', import.meta.url))
const text = (name) => readFileSync(path.join(root, name), 'utf8')

export const fileCases = [
  ['HTML contiene idioma, charset y viewport movil', () => {
    const html = text('demo.html')
    assert.match(html, /<!doctype html>/i); assert.match(html, /lang="es"/)
    assert.match(html, /charset="UTF-8"/); assert.match(html, /width=device-width, initial-scale=1/)
  }],
  ['grafo estatico de imports demo no alcanza Auth/Supabase ni URL remota', () => {
    const seen = new Set()
    function walk(relative) {
      if (seen.has(relative)) return; seen.add(relative)
      assert.doesNotMatch(relative, /(?:services\/supabase|supabaseClient|AuthContext|MembershipContext)/)
      const content = text(relative)
      const imports = [...content.matchAll(/(?:import\s+(?:[^'";]*?\s+from\s*)?|export\s+[^'";]*?\s+from\s*)['"]([^'"]+)['"]/g)]
      for (const [, target] of imports) {
        if (!target.startsWith('.')) { assert.ok(['react', 'react-dom/client'].includes(target), `Unexpected dependency: ${target}`); continue }
        const base = path.posix.normalize(path.posix.join(path.posix.dirname(relative), target))
        const resolved = [base, `${base}.js`, `${base}.jsx`].find((candidate) => existsSync(path.join(root, candidate)))
        assert.ok(resolved, `Missing import: ${relative} -> ${target}`)
        if (!resolved.endsWith('.css')) walk(resolved)
      }
      // Static evidence only; live browser request interception remains required.
      assert.doesNotMatch(content, /\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\s*[.(]/)
    }
    walk('src/demo/main.jsx')
    assert.ok(seen.has('src/components/workers/WorkersWorkspace.jsx'))
  }],
  ['fixture solo se importa desde la entrada de demostracion', () => {
    function scan(dir) {
      for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const name = `${dir}/${entry.name}`
        if (entry.isDirectory()) scan(name)
        else if (/\.(jsx?|mjs)$/.test(name) && !name.includes('.test.') && name !== 'src/demo/main.jsx' && name !== 'src/data/demoWorkers.js') {
          assert.doesNotMatch(text(name), /from\s*['"][^'"]*demoWorkers/)
        }
      }
    }
    scan('src')
  }],
]
