// Runs vitest with an upper-case drive letter in the cwd and in vitest's own path.
// On Windows, editors often open the folder as `c:\…`; vitest then gets loaded twice
// (once per spelling) and every test file fails with "Vitest failed to find the current suite".
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase())
process.chdir(cwd)
await import(pathToFileURL(join(cwd, 'node_modules', 'vitest', 'vitest.mjs')).href)
