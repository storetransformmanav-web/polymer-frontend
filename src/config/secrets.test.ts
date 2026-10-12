/// <reference types="node" />
// (This test reads source files from disk, so it needs Node's types; the
// browser code in src/ deliberately doesn't.)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guards against shipping secrets to the browser. Everything the app bundles
 * (and every `VITE_` variable) is readable by anyone who opens dev tools, so
 * secrets must live in the backend, never here.
 */

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

const isTest = (path: string) =>
  /\.test\.tsx?$/.test(path) || path.includes(`${sep}test${sep}`)
const productionFiles = sourceFiles(SRC).filter((path) => !isTest(path))
const rel = (path: string) => relative(ROOT, path).split(sep).join('/')

// Names that suggest a secret. A `VITE_` variable with one of these is a mistake:
// Vite copies it into the public bundle.
const SECRET_NAME = /SECRET|PASSWORD|PASSWD|PRIVATE|TOKEN|API_?KEY|CREDENTIAL/i

describe('no secrets in the browser bundle', () => {
  it('declares no secret-looking VITE_ variables in .env.example', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8')
    const names = [...example.matchAll(/^\s*(VITE_[A-Z0-9_]+)\s*=/gm)].map((m) => m[1])

    expect(names.length).toBeGreaterThan(0)
    expect(names.filter((name) => SECRET_NAME.test(name))).toEqual([])
  })

  it('types no secret-looking VITE_ variables in vite-env.d.ts', () => {
    const typings = readFileSync(join(SRC, 'vite-env.d.ts'), 'utf8')
    const names = [...typings.matchAll(/(VITE_[A-Z0-9_]+)/g)].map((m) => m[1])

    expect(names.filter((name) => SECRET_NAME.test(name))).toEqual([])
  })

  it('reads import.meta.env only in config/env.ts', () => {
    const offenders = productionFiles
      .filter((path) => rel(path) !== 'src/config/env.ts')
      .filter((path) => readFileSync(path, 'utf8').includes('import.meta.env'))
      .map(rel)

    expect(offenders).toEqual([])
  })

  it('contains no hard-coded credentials or key material', () => {
    const patterns: [string, RegExp][] = [
      ['Shopify Admin API token', /shp(at|ss|ca|pa)_[a-f0-9]{16,}/i],
      ['Stripe secret key', /sk_(live|test)_[A-Za-z0-9]{10,}/],
      ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
      ['AWS access key', /AKIA[0-9A-Z]{16}/],
      ['Google API key', /AIza[0-9A-Za-z_-]{30,}/],
      ['hard-coded bearer token', /Bearer\s+[A-Za-z0-9._-]{20,}/],
      ['JWT', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
    ]

    const findings = productionFiles.flatMap((path) => {
      const text = readFileSync(path, 'utf8')
      return patterns
        .filter(([, pattern]) => pattern.test(text))
        .map(([label]) => `${rel(path)}: ${label}`)
    })

    expect(findings).toEqual([])
  })

  it('never logs to the browser console from production code', () => {
    const offenders = productionFiles
      .filter((path) =>
        /console\.(log|debug|info|warn|error|trace)\(/.test(readFileSync(path, 'utf8')),
      )
      .map(rel)

    expect(offenders).toEqual([])
  })
})

describe('safe rendering', () => {
  it('never injects raw HTML or evaluates strings in production code', () => {
    const banned = [
      /dangerouslySetInnerHTML/,
      /\.innerHTML\s*=/,
      /\.outerHTML\s*=/,
      /insertAdjacentHTML/,
      /document\.write\(/,
      /\beval\(/,
      /new Function\(/,
    ]

    const offenders = productionFiles
      .filter((path) => {
        const text = readFileSync(path, 'utf8')
        return banned.some((pattern) => pattern.test(text))
      })
      .map(rel)

    expect(offenders).toEqual([])
  })

  it('opens every target="_blank" link with rel="noopener noreferrer"', () => {
    const offenders = productionFiles
      .filter((path) => path.endsWith('.tsx'))
      .flatMap((path) => {
        const text = readFileSync(path, 'utf8')
        // Each <a …> tag that opens a new tab must also carry the rel attribute.
        return [...text.matchAll(/<a\b[^>]*>/g)]
          .map((m) => m[0])
          .filter(
            (tag) =>
              tag.includes('target="_blank"') && !tag.includes('noopener noreferrer'),
          )
          .map(() => rel(path))
      })

    expect(offenders).toEqual([])
  })
})
