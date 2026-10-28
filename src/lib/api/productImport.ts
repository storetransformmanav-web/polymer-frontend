/**
 * `POST /products/import` (a Shopify-format CSV) and `GET /products/import/{import_id}`: the
 * request's form and how the answers are read.
 *
 * The API's description says what the calls do but not the exact fields of their answers, so
 * the answers are read **leniently**: the plan and the progress can be flat or wrapped in
 * `result` / `plan` / `data`…, an id can be `import_id` or `id`, and a count is any whole number
 * the answer gives. Nothing here throws on an unexpected shape — what can't be read is simply
 * not shown — so an import that really started is never reported as a failure over a key name
 * (the same lesson as the create answer; see "Write answers are enveloped" in CLAUDE.md).
 * Check a new field against the real answer in the Network tab.
 */

/** The choices sent with the file. */
export interface ProductImportOptions {
  /** Store key the products belong to, e.g. "polymer-uk". */
  shop: string
  /** True: only check the file and say what would happen (nothing changes in the store). */
  dryRun: boolean
  /** Create products whose handle isn't in the store yet. */
  createNew: boolean
  /** Update products whose handle already exists. */
  updateExisting: boolean
}

/** The multipart form `POST /products/import` takes — `file` first, then the choices. */
export function buildImportForm(file: File, options: ProductImportOptions): FormData {
  const form = new FormData()
  form.append('file', file, file.name)
  form.append('shop', options.shop)
  form.append('dry_run', String(options.dryRun))
  form.append('create_new', String(options.createNew))
  form.append('update_existing', String(options.updateExisting))
  return form
}

/** A row the import skipped (or would skip), with what was wrong. */
export interface ImportProblem {
  /** The CSV row, when the answer says which. */
  row: number | null
  handle: string | null
  message: string
}

/** What a check or a started import answers: the plan. */
export interface ProductImportPlan {
  /** What `GET /products/import/{import_id}` is asked with — null when the answer has none. */
  importId: string | null
  message: string
  /** Every whole-number figure the answer gives, by its key ("to_create", "total_rows"…). */
  counts: Record<string, number>
  problems: ImportProblem[]
}

export type ImportRunState = 'running' | 'done' | 'failed'

/** How a started import is going. */
export interface ProductImportProgress {
  state: ImportRunState
  /** The backend's own word for it ("running", "completed"…). */
  status: string
  processed: number | null
  total: number | null
  message: string
  counts: Record<string, number>
  problems: ImportProblem[]
}

type Json = Record<string, unknown>

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Objects an answer may nest its content in. */
const WRAPPERS = ['result', 'plan', 'import', 'data', 'summary', 'progress', 'stats']

/** The answer's objects: the ones it nests content in (deepest first), then the body itself. */
function layersOf(data: unknown): Json[] {
  if (!isRecord(data)) return []
  const layers: Json[] = []
  for (const key of WRAPPERS) {
    const inner = data[key]
    if (isRecord(inner)) layers.push(...layersOf(inner))
  }
  layers.push(data)
  return layers
}

/** The first value under any of `keys` (in that order, in any layer) that passes `test`. */
function pick<T>(
  layers: readonly Json[],
  keys: readonly string[],
  test: (value: unknown) => value is T,
): T | undefined {
  for (const key of keys) {
    for (const layer of layers) {
      if (test(layer[key])) return layer[key] as T
    }
  }
  return undefined
}

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== ''
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const isIdLike = (value: unknown): value is string | number =>
  isText(value) || isCount(value)

/** Numbers that are not figures about the import. */
const NOT_COUNTS = new Set([
  'code',
  'status_code',
  'page',
  'page_size',
  'limit',
  'offset',
  'id',
  'import_id',
  'importId',
  'job_id',
])

function countsOf(layers: readonly Json[], leave: ReadonlySet<string> = new Set()) {
  const counts: Record<string, number> = {}
  // The body first, so a nested object's own figure wins over a same-named one outside it.
  for (const layer of [...layers].reverse()) {
    for (const [key, value] of Object.entries(layer)) {
      if (isCount(value) && !NOT_COUNTS.has(key) && !leave.has(key)) counts[key] = value
    }
  }
  return counts
}

const PROBLEM_LISTS = [
  'errors',
  'problems',
  'row_errors',
  'invalid_rows',
  'skipped_rows',
  'failed_rows',
  'failures',
  'skipped',
]

function problemOf(item: unknown): ImportProblem | null {
  if (isText(item)) return { row: null, handle: null, message: item.trim() }
  if (!isRecord(item)) return null
  const row = pick([item], ['row', 'line', 'row_number', 'line_number', 'index'], isCount)
  const handle = pick([item], ['handle', 'product_handle'], isText)
  let message = pick(
    [item],
    ['message', 'error', 'reason', 'detail', 'problem', 'description'],
    isText,
  )
  if (!message && Array.isArray(item.errors)) {
    message = item.errors.filter(isText).join('; ') || undefined
  }
  return {
    row: row ?? null,
    handle: handle ?? null,
    message: message?.trim() || 'Problem',
  }
}

function problemsOf(layers: readonly Json[]): ImportProblem[] {
  const problems: ImportProblem[] = []
  for (const layer of layers) {
    // In the order the answer gives them.
    for (const [key, list] of Object.entries(layer)) {
      if (!PROBLEM_LISTS.includes(key) || !Array.isArray(list)) continue
      for (const item of list) {
        const problem = problemOf(item)
        if (problem) problems.push(problem)
      }
    }
  }
  return problems
}

/** The message the answer carries — the outermost one (the body's own) first. */
function messageOf(layers: readonly Json[]): string {
  return (
    pick([...layers].reverse(), ['message', 'detail', 'summary_text'], isText)?.trim() ??
    ''
  )
}

/** Reads the answer to a check or a started import. */
export function readImportPlan(data: unknown): ProductImportPlan {
  const layers = layersOf(data)
  const id = pick(layers, ['import_id', 'importId', 'id', 'job_id'], isIdLike)
  return {
    importId: id === undefined ? null : String(id),
    message: messageOf(layers),
    counts: countsOf(layers),
    problems: problemsOf(layers),
  }
}

const DONE = new Set([
  'completed',
  'complete',
  'done',
  'finished',
  'success',
  'succeeded',
  'imported',
])
const FAILED = new Set([
  'failed',
  'failure',
  'error',
  'errored',
  'cancelled',
  'canceled',
  'aborted',
])
const RUNNING = new Set([
  'queued',
  'pending',
  'running',
  'processing',
  'started',
  'in_progress',
  'in progress',
  'accepted',
])

const PROCESSED_KEYS = [
  'processed',
  'processed_rows',
  'rows_processed',
  'handles_processed',
  'done_rows',
  'completed_rows',
]
const TOTAL_KEYS = [
  'total',
  'total_rows',
  'rows_total',
  'total_handles',
  'handles_total',
  'products_total',
]

/** Reads the answer to `GET /products/import/{import_id}`. */
export function readImportProgress(data: unknown): ProductImportProgress {
  const layers = layersOf(data)
  const isRunWord = (value: unknown): value is string =>
    isText(value) &&
    [DONE, FAILED, RUNNING].some((words) => words.has(value.trim().toLowerCase()))
  const word = pick(layers, ['status', 'state'], isRunWord)
  const known = word?.trim().toLowerCase()
  const finishedAt = pick(layers, ['finished_at', 'completed_at'], isText)

  let state: ImportRunState = 'running'
  if (known && FAILED.has(known)) state = 'failed'
  else if (known && DONE.has(known)) state = 'done'
  else if (!known && finishedAt) state = 'done'

  return {
    state,
    status: word ?? pick(layers, ['status', 'state'], isText) ?? '',
    processed: pick(layers, PROCESSED_KEYS, isCount) ?? null,
    total: pick(layers, TOTAL_KEYS, isCount) ?? null,
    message: messageOf(layers),
    counts: countsOf(layers, new Set([...PROCESSED_KEYS, ...TOTAL_KEYS])),
    problems: problemsOf(layers),
  }
}
