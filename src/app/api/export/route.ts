import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getFiscalYearLabel } from '@/lib/fiscalYear'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // Dynamically import ExcelJS (server-side only)
    const ExcelJS = (await import('exceljs')).default

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: true })

    if (error) throw error

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Cash Book App — surravipharma'
    wb.created = new Date()

    // ── Group transactions by fiscal year ──────────────────────────
    const byFY: Record<string, typeof transactions> = {}
    for (const tx of transactions ?? []) {
      const fy = getFiscalYearLabel(tx.date)
      if (!byFY[fy]) byFY[fy] = []
      byFY[fy].push(tx)
    }

    // If no data, create an empty FY sheet for current year
    if (Object.keys(byFY).length === 0) {
      byFY[getFiscalYearLabel(new Date())] = []
    }

    // Sort FY labels chronologically
    const fyLabels = Object.keys(byFY).sort()

    // Colours
    const HEADER_BG = '1565C0'  // blue
    const HEADER_FG = 'FFFFFF'
    const INCOME_BG = 'F0FDF4'
    // EXPENSE_BG removed (unused)
    const INCOME_FG = '065F46'
    const EXPENSE_FG = '991B1B'
    const ALT_ROW = 'F8FAFC'
    const BORDER_COLOR = 'CBD5E1'
    const TOTAL_BG = 'EFF6FF'
    const TOTAL_FG = '1E40AF'

    for (const fy of fyLabels) {
      const txns = byFY[fy] ?? []
      const ws = wb.addWorksheet(`FY ${fy}`, {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
        views: [{ state: 'frozen', ySplit: 3 }],
      })

      // ── Column definitions ─────────────────────────────────────────
      ws.columns = [
        { key: 'sno',          width: 5  },
        { key: 'date',         width: 14 },
        { key: 'type',         width: 10 },
        { key: 'account',      width: 10 },
        { key: 'description',  width: 30 },
        { key: 'category',     width: 22 },
        { key: 'sub_category', width: 22 },
        { key: 'payment_mode', width: 14 },
        { key: 'notes',        width: 24 },
        { key: 'income',       width: 14 },
        { key: 'expense',      width: 14 },
        { key: 'balance',      width: 14 },
      ]

      // ── Row 1: Title ───────────────────────────────────────────────
      ws.mergeCells('A1:L1')
      const titleCell = ws.getCell('A1')
      titleCell.value = `📒  Cash Book — FY ${fy}  |  surravipharma`
      titleCell.font = { bold: true, size: 13, color: { argb: HEADER_FG }, name: 'Calibri' }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      ws.getRow(1).height = 30

      // ── Row 2: Sub-title (generated date) ─────────────────────────
      ws.mergeCells('A2:L2')
      const subCell = ws.getCell('A2')
      subCell.value = `Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}  •  ${txns.length} transactions`
      subCell.font = { size: 10, color: { argb: '64748B' }, italic: true }
      subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } }
      subCell.alignment = { horizontal: 'center', vertical: 'middle' }
      ws.getRow(2).height = 20

      // ── Row 3: Column headers ──────────────────────────────────────
      const headers = ['#', 'Date', 'Type', 'Account', 'Description', 'Category', 'Sub-Category', 'Payment Mode', 'Notes / Ref No.', 'Income (₹)', 'Expense (₹)', 'Balance (₹)']
      const headerRow = ws.getRow(3)
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1)
        cell.value = h
        cell.font = { bold: true, size: 10, color: { argb: HEADER_FG }, name: 'Calibri' }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
        cell.alignment = { horizontal: i >= 9 ? 'right' : 'center', vertical: 'middle', wrapText: true }
        cell.border = {
          bottom: { style: 'medium', color: { argb: '0EA5E9' } },
        }
      })
      headerRow.height = 28

      // ── Data rows ─────────────────────────────────────────────────
      let runningBalance = 0
      let totalIncome = 0
      let totalExpense = 0

      txns.forEach((tx, idx) => {
        const rowNum = idx + 4
        const row = ws.getRow(rowNum)
        const isIncome = tx.type === 'income'
        const incomeAmt = isIncome ? tx.amount : 0
        const expenseAmt = isIncome ? 0 : tx.amount
        runningBalance += isIncome ? tx.amount : -tx.amount
        totalIncome += incomeAmt
        totalExpense += expenseAmt

        const isAlt = idx % 2 === 1
        const rowBg = isIncome ? INCOME_BG : (isAlt ? ALT_ROW : 'FFFFFF')

        const values = [
          idx + 1,
          new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
          tx.account,
          tx.description || '',
          tx.category || '',
          tx.sub_category || '',
          tx.payment_mode || '',
          tx.notes || '',
          incomeAmt || '',
          expenseAmt || '',
          runningBalance,
        ]

        values.forEach((val, ci) => {
          const cell = row.getCell(ci + 1)
          cell.value = val
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg.replace('#', '') } }
          cell.font = { size: 10, name: 'Calibri' }
          cell.alignment = { vertical: 'middle', horizontal: ci >= 9 ? 'right' : (ci === 0 ? 'center' : 'left') }
          cell.border = {
            bottom: { style: 'hair', color: { argb: BORDER_COLOR } },
          }

          // Colour type column
          if (ci === 2) {
            cell.font = { bold: true, size: 10, color: { argb: isIncome ? INCOME_FG : EXPENSE_FG } }
          }

          // Number format for amounts
          if (ci >= 9) {
            if (typeof val === 'number' && val !== 0) {
              cell.numFmt = '₹#,##0.00'
              if (ci === 11) { // balance
                cell.font = { bold: true, size: 10, color: { argb: runningBalance >= 0 ? INCOME_FG : EXPENSE_FG } }
              } else {
                cell.font = { bold: false, size: 10, color: { argb: ci === 9 ? INCOME_FG : EXPENSE_FG } }
              }
            }
          }
        })

        row.height = 22
      })

      // ── Totals row ─────────────────────────────────────────────────
      const totalRowNum = txns.length + 4
      const totalRow = ws.getRow(totalRowNum)
      ws.mergeCells(`A${totalRowNum}:I${totalRowNum}`)
      const labelCell = totalRow.getCell(1)
      labelCell.value = `TOTAL  (${txns.length} entries)`
      labelCell.font = { bold: true, size: 10, color: { argb: TOTAL_FG }, name: 'Calibri' }
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } }
      labelCell.alignment = { horizontal: 'right', vertical: 'middle' }

      ;[
        { col: 10, val: totalIncome,   color: INCOME_FG },
        { col: 11, val: totalExpense,  color: EXPENSE_FG },
        { col: 12, val: runningBalance, color: runningBalance >= 0 ? INCOME_FG : EXPENSE_FG },
      ].forEach(({ col, val, color }) => {
        const cell = totalRow.getCell(col)
        cell.value = val
        cell.numFmt = '₹#,##0.00'
        cell.font = { bold: true, size: 11, color: { argb: color }, name: 'Calibri' }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } }
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
        cell.border = {
          top: { style: 'medium', color: { argb: HEADER_BG } },
          bottom: { style: 'medium', color: { argb: HEADER_BG } },
        }
      })
      totalRow.height = 26

      // ── Summary box (below totals) ─────────────────────────────────
      const summaryStart = totalRowNum + 2
      const summaryData = [
        ['', ''],
        ['Total Income',  totalIncome],
        ['Total Expense', totalExpense],
        ['Net Balance',   runningBalance],
      ]
      summaryData.forEach(([label, val], i) => {
        if (!label) return
        const r = ws.getRow(summaryStart + i)
        const c1 = r.getCell(10)
        // c2 removed (unused)
        ws.mergeCells(`J${summaryStart + i}:K${summaryStart + i}`)
        c1.value = label
        c1.font = { bold: true, size: 10, name: 'Calibri' }
        c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } }
        c1.alignment = { horizontal: 'right', vertical: 'middle' }
        const c3 = r.getCell(12)
        c3.value = val as number
        c3.numFmt = '₹#,##0.00'
        const color = label === 'Total Income' ? INCOME_FG : label === 'Total Expense' ? EXPENSE_FG : (val as number) >= 0 ? INCOME_FG : EXPENSE_FG
        c3.font = { bold: true, size: 10, color: { argb: color }, name: 'Calibri' }
        c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } }
        c3.alignment = { horizontal: 'right', vertical: 'middle' }
        r.height = 22
      })

      // Freeze header rows
      ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 0, activeCell: 'A4' }]
    }

    // ── Write to buffer ────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()

    const fyLabel = getFiscalYearLabel(new Date())
    const filename = `CashBook_${fyLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
