import { NextRequest, NextResponse } from 'next/server'
import { getFiscalYearLabel } from '@/lib/fiscalYear'

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL

  if (!webhookUrl) {
    // Silently skip if not configured
    return NextResponse.json({ skipped: true, reason: 'No webhook URL configured' })
  }

  try {
    const body = await req.json()
    const { transaction } = body

    if (!transaction) {
      return NextResponse.json({ error: 'Missing transaction' }, { status: 400 })
    }

    const fy = getFiscalYearLabel(transaction.date)

    // Payload sent to Make.com / Zapier
    // The webhook should be configured to:
    //   1. Find or create a Google Sheet tab named "FY XXXX-XX"
    //   2. Append a new row with the fields below
    const payload = {
      // Sheet routing
      sheet_name: `FY ${fy}`,                 // Tab name: "FY 2025-26"
      fiscal_year: fy,                          // "2025-26"

      // Transaction data
      id:           transaction.id,
      date:         transaction.date,
      type:         transaction.type,           // "income" | "expense"
      account:      transaction.account,
      amount:       transaction.amount,
      category:     transaction.category   ?? '',
      sub_category: transaction.sub_category ?? '',
      description:  transaction.description  ?? '',
      payment_mode: transaction.payment_mode  ?? '',
      notes:        transaction.notes         ?? '',
      created_at:   transaction.created_at,

      // Pre-formatted for direct paste into cells
      income_amount:  transaction.type === 'income'  ? transaction.amount : 0,
      expense_amount: transaction.type === 'expense' ? transaction.amount : 0,
      date_formatted: new Date(transaction.date).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      }),
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(`Webhook returned ${res.status}`)
    }

    return NextResponse.json({ success: true, sheet_name: `FY ${fy}` })
  } catch (err) {
    console.error('Google Sheets webhook error:', err)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}
