# 📒 Cash Book App

**Next.js 14 · Material UI · Supabase · PWA · Excel Export · Google Sheets Sync**

---

## ✅ Features

| Feature | Details |
|---|---|
| **PWA** | Installable on Android & iOS, offline-capable via service worker |
| **Responsive** | Mobile-first, works on all screen sizes |
| **Light Mode** | Clean white/navy theme |
| **Fiscal Year** | Auto-detects Indian FY (Apr–Mar). New entries auto-switch to their FY. |
| **Dashboard** | Summary cards, monthly bar chart, category pie, account balances |
| **Transactions** | Date-grouped list, search, filter by type/account/category |
| **Add Entry** | Bottom drawer with Income/Expense toggle, tag chips for Account/Category/Sub-Category/Payment Mode |
| **Excel Download** | One sheet per fiscal year (named "FY 2025-26"), styled with totals |
| **Google Sheets Sync** | Webhook (Make.com / Zapier) — appends each new entry to the right FY tab |
| **Supabase** | Real-time PostgreSQL storage |

---

## 🚀 Quick Start

### 1. Install
```bash
unzip cashbook-app.zip
cd cashbook-app
npm install
```

### 2. Database — run this in Supabase SQL Editor
```sql
-- paste contents of supabase-schema.sql
```

### 3. Environment
`.env.local` is pre-filled with your Supabase credentials.
To add Google Sheets sync, add your webhook URL:
```
GOOGLE_SHEETS_WEBHOOK_URL=https://hook.eu1.make.com/xxxxx
```

### 4. Run
```bash
npm run dev
# open http://localhost:3000
```

### 5. Deploy (Vercel — recommended)
```bash
npm i -g vercel
vercel
# Add env vars in Vercel dashboard → Settings → Environment Variables
```

---

## 📊 Excel Download

Click the **↓** icon in the header.

- File is named: `CashBook_2025-26_2025-03-23.xlsx`
- One sheet per fiscal year: `FY 2025-26`, `FY 2026-27`, etc.
- Each sheet has: #, Date, Type, Account, Description, Category, Sub-Category, Payment Mode, Notes, Income (₹), Expense (₹), Running Balance (₹)
- Styled with colour-coded rows (green = income, white = expense), bold totals, summary box

---

## 🔗 Google Sheets Sync (Make.com — Recommended)

### One-time setup in Make.com:

1. Go to [make.com](https://make.com) → Create Scenario
2. **Trigger**: Webhooks → Custom Webhook → Copy the URL
3. Add the URL to `.env.local`:
   ```
   GOOGLE_SHEETS_WEBHOOK_URL=https://hook.eu1.make.com/your-webhook-id
   ```
4. **Action**: Google Sheets → Search Rows → check if sheet named `{{sheet_name}}` exists  
   If not → Create Sheet (name: `{{sheet_name}}`)
5. **Next Action**: Google Sheets → Add a Row
   - Spreadsheet: your spreadsheet
   - Sheet: `{{sheet_name}}` (e.g. "FY 2025-26")
   - Map fields:
     | Column | Value |
     |---|---|
     | A | `{{date_formatted}}` |
     | B | `{{type}}` |
     | C | `{{account}}` |
     | D | `{{description}}` |
     | E | `{{category}}` |
     | F | `{{sub_category}}` |
     | G | `{{payment_mode}}` |
     | H | `{{notes}}` |
     | I | `{{income_amount}}` |
     | J | `{{expense_amount}}` |

6. **Activate** the scenario → test by adding a transaction

The app sends this payload to your webhook on every new entry:
```json
{
  "sheet_name": "FY 2025-26",
  "fiscal_year": "2025-26",
  "date": "2025-03-23",
  "date_formatted": "23 Mar 2025",
  "type": "expense",
  "account": "ICICI",
  "amount": 1500,
  "income_amount": 0,
  "expense_amount": 1500,
  "category": "Office",
  "sub_category": "Rent",
  "description": "Office rent March",
  "payment_mode": "RTGS/NEFT",
  "notes": "UTR123456"
}
```

> **Fiscal Year auto-handling**: `sheet_name` is always `"FY 2025-26"` format.
> In Make, use a Router to check the sheet name and create a new tab automatically when the year changes.

---

## 🗂️ Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── export/route.ts       ← Excel download (all FYs, one sheet each)
│   │   ├── google-sheets/route.ts ← Webhook relay to Make/Zapier
│   │   └── settings/route.ts     ← Webhook status check
│   ├── page.tsx                  ← Main page (tabs, FABs, FY selector)
│   ├── layout.tsx
│   ├── globals.css
│   ├── MuiProvider.tsx
│   └── EmotionCache.tsx
├── components/
│   ├── Dashboard.tsx             ← Cards, charts, recent entries
│   ├── TransactionList.tsx       ← Grouped list with search/filter
│   └── AddTransactionDrawer.tsx  ← Bottom sheet entry form
└── lib/
    ├── supabase.ts
    ├── constants.ts              ← Accounts, categories, payment modes
    └── fiscalYear.ts             ← FY calculation utilities
```

---

## 🗄️ Supabase Schema

See `supabase-schema.sql` — run once in Supabase SQL Editor.

Key table: `transactions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Auto |
| date | date | Transaction date |
| type | text | `income` or `expense` |
| account | text | ICICI / SBI / Cash |
| amount | numeric(12,2) | Positive number |
| category | text | |
| sub_category | text | |
| description | text | |
| payment_mode | text | |
| notes | text | UTR / cheque / memo |
| created_at | timestamptz | Auto |

---

## 📱 PWA Install

**Android**: Open in Chrome → Three dots menu → "Add to Home Screen"  
**iOS**: Open in Safari → Share button → "Add to Home Screen"

Shortcuts available after install:
- Long-press icon → **Add Income**
- Long-press icon → **Add Expense**
