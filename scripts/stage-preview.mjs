// Copies the generated site (.output/public) to .preview/<base path>/ so that
// `serve .preview` serves it under the same sub-path as GitHub Pages, e.g. /Landing-page/.
// Serving .output/public directly would put the page at '/', and every
// /Landing-page/_nuxt/... request would then fail with 404.
import { access, cp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
// Node 22.18+ strips TypeScript types on import, so this reads the same site URL as nuxt.config.ts.
import { site } from '../app/data/site.ts'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const generatedDir = join(projectRoot, '.output', 'public')
const previewRoot = join(projectRoot, '.preview')
const basePath = new URL(site.url).pathname

try {
  await access(join(generatedDir, 'index.html'))
}
catch {
  console.error('No generated site in .output/public. Run `npm run generate` first.')
  process.exit(1)
}

await rm(previewRoot, { recursive: true, force: true })
await cp(generatedDir, join(previewRoot, basePath), { recursive: true })

console.log(`Staged .output/public in .preview${basePath}`)
