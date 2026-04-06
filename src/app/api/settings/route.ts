import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    webhookConfigured: !!process.env.GOOGLE_SHEETS_WEBHOOK_URL,
    // Never expose the actual URL
  })
}
