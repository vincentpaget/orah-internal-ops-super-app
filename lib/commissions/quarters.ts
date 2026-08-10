const Q_STARTS = ['01-01', '04-01', '07-01', '10-01']
const Q_ENDS = ['03-31', '06-30', '09-30', '12-31']

export function currentQuarterKey(): string {
  const today = new Date()
  return `${today.getFullYear()}-Q${Math.floor(today.getMonth() / 3) + 1}`
}

function quarterIndex(key: string): number {
  const [yearStr, qStr] = key.split('-Q')
  return Number(yearStr) * 4 + (Number(qStr) - 1)
}

export function nextQuarterKey(key: string): string {
  return quarterKeyFromIndex(quarterIndex(key) + 1)
}

function quarterKeyFromIndex(index: number): string {
  const year = Math.floor(index / 4)
  const q = index % 4
  return `${year}-Q${q + 1}`
}

export function quarterKeyForDate(dateStr: string): string {
  const [yearStr, monthStr] = dateStr.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`
}

export function quarterLabel(key: string): string {
  const [year, q] = key.split('-Q')
  return `Q${q} ${year}`
}

export function quarterDateRange(key: string): { start: string; end: string } {
  const [yearStr, qStr] = key.split('-Q')
  const year = Number(yearStr)
  const q = Number(qStr) - 1
  return { start: `${year}-${Q_STARTS[q]}`, end: `${year}-${Q_ENDS[q]}` }
}

/** Most recent quarter first. */
export function listQuarterOptions(back = 7, forward = 0): { value: string; label: string }[] {
  const currentIndex = quarterIndex(currentQuarterKey())
  const options: { value: string; label: string }[] = []
  for (let i = currentIndex + forward; i >= currentIndex - back; i--) {
    const key = quarterKeyFromIndex(i)
    options.push({ value: key, label: quarterLabel(key) })
  }
  return options
}

/** The current quarter and the `n - 1` before it, most recent first. */
export function defaultTrailingQuarterKeys(n = 4): string[] {
  const currentIndex = quarterIndex(currentQuarterKey())
  const keys: string[] = []
  for (let i = 0; i < n; i++) keys.push(quarterKeyFromIndex(currentIndex - i))
  return keys
}

/** Inclusive range from `startKey` to `endKey`, oldest first. */
export function quarterKeyRange(startKey: string, endKey: string): string[] {
  const startIndex = quarterIndex(startKey)
  const endIndex = quarterIndex(endKey)
  const keys: string[] = []
  for (let i = startIndex; i <= endIndex; i++) keys.push(quarterKeyFromIndex(i))
  return keys
}
