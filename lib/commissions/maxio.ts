/**
 * Maxio invoice lines → what's actually been invoiced and paid on a deal, split by what earns commission.
 * Source: the Maxio (SaaSOptics) objects synced into Salesforce — `saasoptics__invoice_line_item__c` links each
 * line to its Opportunity and its parent `saasoptics__invoice__c`, which carries the invoice status.
 * Client-safe (no jsforce) so the classification can be unit-tested and reused in the UI.
 */

export type InvoiceLineKind = 'arr' | 'onboarding' | 'excluded'

/** One Maxio invoice line, as the app reads it. Amounts are in the invoice's local currency (the deal's currency). */
export interface MaxioInvoiceLine {
  opportunityId: string
  invoiceNumber: string | null
  invoiceDate: string | null
  invoiceStatus: string | null
  itemCode: string | null
  itemName: string | null
  amount: number
}

/** Per-deal totals from the deal's Maxio invoice lines. */
export interface MaxioInvoiceSummary {
  lineCount: number
  /** Subscription lines on invoices with status Paid — the ARR invoiced and paid (comp plan §4). */
  arrPaid: number
  arrInvoiced: number
  /** Onboarding / PS lines (item code PS_) — the fee as actually billed, and how much of it is on paid invoices. */
  onboardingInvoiced: number
  onboardingPaid: number
  /** SMS credits, hardware and credits — never earn commission. */
  excludedInvoiced: number
}

/** Item code prefixes for lines that are onboarding / professional services (§5.2). */
const ONBOARDING_PREFIXES = ['PS_']
/** Item code prefixes for one-time lines that earn nothing: SMS credits, hardware, non-recurring credits. */
const EXCLUDED_PREFIXES = ['PAYG_', 'HW_', 'nr_']

export function classifyInvoiceLine(itemCode: string | null): InvoiceLineKind {
  const code = itemCode ?? ''
  if (ONBOARDING_PREFIXES.some(p => code.startsWith(p))) return 'onboarding'
  if (EXCLUDED_PREFIXES.some(p => code.startsWith(p))) return 'excluded'
  // SP_ / SA_ products and the older "supervise | elite"-style codes are all subscription.
  return 'arr'
}

/** Commission is released once an invoice is paid in full — Maxio's "Paid" status (balance 0). */
export function isInvoicePaid(status: string | null): boolean {
  return status === 'Paid'
}

export function summarizeInvoiceLines(lines: MaxioInvoiceLine[]): MaxioInvoiceSummary {
  const summary: MaxioInvoiceSummary = {
    lineCount: lines.length, arrPaid: 0, arrInvoiced: 0, onboardingInvoiced: 0, onboardingPaid: 0, excludedInvoiced: 0,
  }
  for (const line of lines) {
    const paid = isInvoicePaid(line.invoiceStatus)
    switch (classifyInvoiceLine(line.itemCode)) {
      case 'arr':
        summary.arrInvoiced += line.amount
        if (paid) summary.arrPaid += line.amount
        break
      case 'onboarding':
        summary.onboardingInvoiced += line.amount
        if (paid) summary.onboardingPaid += line.amount
        break
      case 'excluded':
        summary.excludedInvoiced += line.amount
        break
    }
  }
  return summary
}
