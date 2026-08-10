import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DealEdit, SFCommissionOpportunity } from './types'
import { nzd, shortDate } from '../formatters'

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
  deals: SFCommissionOpportunity[],
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

  const totalCommission = deals.reduce((s, d) => s + (d.Commission_Amount_NZD__c ?? 0), 0)
  const totalPaid = deals.reduce((s, d) => s + (effectivePaidAmount(d, edits) ?? 0), 0)

  autoTable(doc, {
    startY: 96,
    head: [['Opportunity', 'Close Date', 'Commission Amount', 'Paid Amount', 'Paid Date', 'Notes']],
    body: deals.map(deal => [
      deal.Name,
      shortDate(deal.CloseDate),
      nzd(deal.Commission_Amount_NZD__c),
      nzd(effectivePaidAmount(deal, edits)),
      shortDate(effectivePaidDate(deal, edits)),
      effectiveNotes(deal, edits) || '—',
    ]),
    foot: [['Total', '', nzd(totalCommission), nzd(totalPaid), '', '']],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [0, 39, 68] },
    footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
  })

  const fileSafe = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '')
  doc.save(`Commission-Payable-${fileSafe(ownerName)}-${fileSafe(monthLabel)}.pdf`)
}
