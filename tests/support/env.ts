import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'

const baseFiles = ['.env', '.env.local']
const testFiles = ['.env.test', '.env.test.local']

/**
 * Loads dotenv files for the test processes. Base files never override values
 * already exported by the shell, while test-specific files always win.
 */
export function loadTestEnv() {
  for (const file of baseFiles) {
    const path = resolve(process.cwd(), file)

    if (existsSync(path)) config({ path, override: false, quiet: true })
  }

  for (const file of testFiles) {
    const path = resolve(process.cwd(), file)

    if (existsSync(path)) config({ path, override: true, quiet: true })
  }
}
