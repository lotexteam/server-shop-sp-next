// MapLibre 6.11 worker is a pair of sibling ES modules
// (maplibre-gl-worker.mjs imports ./maplibre-gl-shared.mjs). Next serves the
// main bundle from /_next/static/chunks/<hash>.js and answers the sibling
// path with the HTML app shell, which browsers reject as a module worker
// (MIME text/html). Copy both files into public/ so they are served as JS.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/maplibre-gl/dist')
const dest = resolve(root, 'public/maplibre')

mkdirSync(dest, { recursive: true })
for (const name of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
    copyFileSync(resolve(src, name), resolve(dest, name))
}
