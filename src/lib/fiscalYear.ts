/**
 * Indian Fiscal Year: April 1 → March 31
 * e.g. date in Apr 2025 – Mar 2026  →  "FY 2025-26"
 *      date in Apr 2026 – Mar 2027  →  "FY 2026-27"
 */
export function getFiscalYear(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const month = d.getMonth() // 0-based; 3 = April
  const year = d.getFullYear()
  const fyStart = month >= 3 ? year : year - 1
  const fyEnd = (fyStart + 1).toString().slice(-2)
  return `FY ${fyStart}-${fyEnd}`
}

/** Returns "2025-26" label used as sheet/file name */
export function getFiscalYearLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const month = d.getMonth()
  const year = d.getFullYear()
  const fyStart = month >= 3 ? year : year - 1
  const fyEnd = (fyStart + 1).toString().slice(-2)
  return `${fyStart}-${fyEnd}`
}

/** Start date of a fiscal year: April 1 */
export function fyStartDate(fyLabel: string): Date {
  const startYear = parseInt(fyLabel.split('-')[0])
  return new Date(startYear, 3, 1) // April 1
}

/** End date of a fiscal year: March 31, end of day (23:59:59) */
export function fyEndDate(fyLabel: string): Date {
  const endYear = parseInt(fyLabel.split('-')[0]) + 1
  const d = new Date(endYear, 2, 31) // March 31
  d.setHours(23, 59, 59, 999)
  return d
}

/** List of all FY months in order: Apr → Mar */
export const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

/** Sort key for a month string like "Apr-25" */
export function fyMonthSortKey(monthStr: string): number {
  const [mon] = monthStr.split('-')
  return FY_MONTHS.indexOf(mon)
}
