import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DealEdit, SFCommissionOpportunity } from './types'
import { nzd, shortDate } from '../formatters'
import { effectiveOnboardingPaidAmount, effectiveOnboardingPaidDate, onboardingCommissionAmount, onboardingPayableNow, payableNow } from './payments'

function effectivePaidAmount(deal: SFCommissionOpportunity, edits: Record<string, DealEdit>): number | null {
  const edit = edits[deal.Id]
  return edit?.commissionPaidAmount !== undefined ? edit.commissionPaidAmount : deal.Commission_Paid_Amount_NZD__c
}

function effectivePaidDate(deal: SFCommissionOpportunity, edits: Record<string, DealEdit>): string | null {
  const edit = edits[deal.Id]
  return edit?.commissionPaidDate !== undefined ? edit.commissionPaidDate : deal.Commission_Paid_Date__c
}

function effectiveNotes(deal: SFCommissionOpportunity, edits: Record<string, DealEdit>): string | null {
  const edit = edits[deal.Id]
  return edit?.commissionNotes !== undefined ? edit.commissionNotes : deal.Commission_Notes__c
}

export function downloadPayableSummaryPdf(
  ownerName: string,
  monthLabel: string,
  arrDeals: SFCommissionOpportunity[],
  onboardingDeals: SFCommissionOpportunity[],
  edits: Record<string, DealEdit>
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  doc.setFontSize(16)
  doc.text('Commission Payable Summary', 40, 44)
  doc.setFontSize(11)
  doc.setTextColor(80)
  doc.text(`${ownerName} — ${monthLabel}`, 40, 64)
  doc.setFontSize(9)
  doc.setTextColor(140)
  doc.text(`Generated ${new Date().toLocaleDateString('en-NZ')}`, 40, 80)
  doc.setTextColor(0)

  const tableStyle = {
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [0, 39, 68] as [number, number, number] },
    footStyles: { fillColor: [240, 240, 240] as [number, number, number], textColor: 20, fontStyle: 'bold' as const },
    columnStyles: { 2: { halign: 'right' as const }, 3: { halign: 'right' as const }, 4: { halign: 'right' as const } },
  }
  let y = 100
  const section = (title: string) => {
    doc.setFontSize(12)
    doc.text(title, 40, y)
    y += 8
  }
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  // ARR commission — Payable Now is only the earned share; part-earned deals have more to come.
  if (arrDeals.length > 0) {
    section('ARR Commission')
    autoTable(doc, {
      startY: y,
      head: [['Opportunity', 'Close Date', 'Commission Amount', 'Paid to Date', 'Payable Now', 'Paid Date', 'Notes']],
      body: arrDeals.map(deal => [
        deal.Name,
        shortDate(deal.CloseDate),
        nzd(deal.Commission_Amount_NZD__c),
        nzd(effectivePaidAmount(deal, edits)),
        nzd(payableNow(deal, edits)),
        shortDate(effectivePaidDate(deal, edits)),
        effectiveNotes(deal, edits) || '—',
      ]),
      foot: [[
        'Total', '',
        nzd(arrDeals.reduce((s, d) => s + (d.Commission_Amount_NZD__c ?? 0), 0)),
        nzd(arrDeals.reduce((s, d) => s + (effectivePaidAmount(d, edits) ?? 0), 0)),
        nzd(arrDeals.reduce((s, d) => s + payableNow(d, edits), 0)),
        '', '',
      ]],
      ...tableStyle,
    })
    y = lastY() + 28
  }

  // Onboarding commission — calculated in the app, all-or-nothing once the fee is paid in full.
  if (onboardingDeals.length > 0) {
    section('Onboarding Commission')
    autoTable(doc, {
      startY: y,
      head: [['Opportunity', 'Close Date', 'Commission Amount', 'Commission Paid', 'Payable Now', 'Paid Date']],
      body: onboardingDeals.map(deal => [
        deal.Name,
        shortDate(deal.CloseDate),
        nzd(onboardingCommissionAmount(deal)),
        nzd(effectiveOnboardingPaidAmount(deal, edits)),
        nzd(onboardingPayableNow(deal, edits)),
        shortDate(effectiveOnboardingPaidDate(deal, edits)),
      ]),
      foot: [[
        'Total', '',
        nzd(onboardingDeals.reduce((s, d) => s + onboardingCommissionAmount(d), 0)),
        nzd(onboardingDeals.reduce((s, d) => s + (effectiveOnboardingPaidAmount(d, edits) ?? 0), 0)),
        nzd(onboardingDeals.reduce((s, d) => s + onboardingPayableNow(d, edits), 0)),
        '',
      ]],
      ...tableStyle,
    })
  }

  const fileSafe = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '')
  doc.save(`Commission-Payable-${fileSafe(ownerName)}-${fileSafe(monthLabel)}.pdf`)
}
