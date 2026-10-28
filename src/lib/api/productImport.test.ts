import { describe, expect, it } from 'vitest'
import { buildImportForm, readImportPlan, readImportProgress } from './productImport.ts'

const FILE = new File(['Handle,Title\nmop,Mop\n'], 'products.csv', { type: 'text/csv' })

describe('buildImportForm', () => {
  it('sends the file and the documented fields, booleans as text', () => {
    const form = buildImportForm(FILE, {
      shop: 'polymer-uk',
      dryRun: true,
      createNew: true,
      updateExisting: false,
    })

    expect([...form.keys()]).toEqual([
      'file',
      'shop',
      'dry_run',
      'create_new',
      'update_existing',
    ])
    const sent = form.get('file') as File
    expect(sent.name).toBe('products.csv')
    expect(form.get('shop')).toBe('polymer-uk')
    expect(form.get('dry_run')).toBe('true')
    expect(form.get('create_new')).toBe('true')
    expect(form.get('update_existing')).toBe('false')
  })
})

describe('readImportPlan', () => {
  it('reads a flat answer: id, message, figures and the rows with problems', () => {
    const plan = readImportPlan({
      code: 202,
      status: 'Accepted',
      message: 'Import queued',
      import_id: 'imp-1',
      total_rows: 6,
      to_create: 1,
      to_update: 1,
      errors: [{ row: 4, handle: 'bad-bag', message: 'Variant Price is not a number' }],
    })

    expect(plan).toEqual({
      importId: 'imp-1',
      message: 'Import queued',
      counts: { total_rows: 6, to_create: 1, to_update: 1 },
      problems: [{ row: 4, handle: 'bad-bag', message: 'Variant Price is not a number' }],
    })
  })

  it('reads an answer wrapped in result and plan, and an id called id', () => {
    const plan = readImportPlan({
      code: 200,
      message: 'Checked',
      result: { id: 77, plan: { products: 2, skus: 6, images: 16 } },
    })

    expect(plan.importId).toBe('77')
    expect(plan.message).toBe('Checked')
    expect(plan.counts).toEqual({ products: 2, skus: 6, images: 16 })
    expect(plan.problems).toEqual([])
  })

  it('reads problems given as plain text or under another name', () => {
    const plan = readImportPlan({
      skipped_rows: ['Row 9: missing handle', { line: 12, reason: 'Unknown status' }],
      problems: [{ errors: ['no title', 'no price'], handle: 'x' }],
    })

    expect(plan.problems).toEqual([
      { row: null, handle: null, message: 'Row 9: missing handle' },
      { row: 12, handle: null, message: 'Unknown status' },
      { row: null, handle: 'x', message: 'no title; no price' },
    ])
  })

  it('leaves out numbers that are not figures about the import', () => {
    expect(readImportPlan({ code: 200, page: 1, products: 3 }).counts).toEqual({
      products: 3,
    })
  })

  it('never throws on an answer it does not understand', () => {
    for (const odd of [null, undefined, 'text', 42, [], {}, { result: 'x' }]) {
      expect(readImportPlan(odd)).toEqual({
        importId: null,
        message: '',
        counts: {},
        problems: [],
      })
    }
  })
})

describe('readImportProgress', () => {
  it('reads a run that is still going, with how far it is', () => {
    const progress = readImportProgress({
      status: 'running',
      processed: 12,
      total: 40,
      created: 8,
      updated: 4,
    })

    expect(progress).toMatchObject({
      state: 'running',
      status: 'running',
      processed: 12,
      total: 40,
      counts: { created: 8, updated: 4 },
    })
  })

  it.each(['completed', 'Done', 'FINISHED', 'success'])(
    'knows "%s" is finished',
    (word) => {
      expect(readImportProgress({ status: word }).state).toBe('done')
    },
  )

  it.each(['failed', 'error', 'Cancelled'])('knows "%s" is a failure', (word) => {
    expect(readImportProgress({ status: word, message: 'Boom' })).toMatchObject({
      state: 'failed',
      message: 'Boom',
    })
  })

  it('looks inside a wrapper, ahead of the envelope’s own status', () => {
    const progress = readImportProgress({
      code: 200,
      status: 'OK',
      result: { status: 'completed', processed_rows: 5, total_rows: 5, skipped: 1 },
    })

    expect(progress.state).toBe('done')
    expect(progress.processed).toBe(5)
    expect(progress.total).toBe(5)
    expect(progress.counts).toEqual({ skipped: 1 })
  })

  it('counts a finish time as finished when no status says otherwise', () => {
    expect(readImportProgress({ finished_at: '2026-10-28T10:00:00Z' }).state).toBe('done')
  })

  it('carries the rows that were skipped', () => {
    const progress = readImportProgress({
      status: 'completed',
      errors: [{ row: 3, handle: 'a', message: 'Bad price' }],
    })

    expect(progress.problems).toEqual([{ row: 3, handle: 'a', message: 'Bad price' }])
  })

  it('treats an answer it does not understand as still running (the caller stops waiting)', () => {
    expect(readImportProgress({}).state).toBe('running')
    expect(readImportProgress('x').state).toBe('running')
  })
})
