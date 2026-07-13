import { NextRequest, NextResponse } from 'next/server';
import { getConnectionFromCookie } from '@/lib/pricing-migration/salesforce';
import Anthropic from '@anthropic-ai/sdk';
import { PRODUCT_IDS } from '@/lib/pricing-migration/data/pricelist';

const PRODUCT_KEY_LABELS: Record<keyof typeof PRODUCT_IDS, string> = {
  SuperviseBasic:      'Supervise Basic',
  SupervisePro:        'Supervise Pro',
  SuperviseElite:      'Supervise Elite',
  BoardingCore:        'Boarding Core',
  BoardingPro:         'Boarding Pro',
  AddonBoarding:       'Add-on: Boarding Students',
  AddonNurture:        'Add-on: Nurture',
  AddonAutoAttendance: 'Add-on: Auto Attendance',
  AddonDismissals:     'Add-on: Dismissals',
  AddonOpenAPI:        'Add-on: Open API',
};

interface OverrideLine {
  productKey: keyof typeof PRODUCT_IDS;
  quantity: number;
  unitPrice: number;
}

export async function POST(req: NextRequest) {
  const conn = await getConnectionFromCookie();
  if (!conn) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await req.json();
  const {
    opportunityName, currency, renewalDate,
    rawInputs, step1, step2, step3,
    editableLines, originalLines, effectiveTotal, baseTotal,
    step5, step6, autoRenewalBaseline,
    matchAutoRenewal,
  } = body;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  const linesChanged =
    JSON.stringify((editableLines as OverrideLine[]).map(l => l.productKey).sort()) !==
    JSON.stringify((originalLines as OverrideLine[]).map(l => l.productKey).sort()) ||
    (editableLines as OverrideLine[]).some((l: OverrideLine, i: number) =>
      (originalLines as OverrideLine[])[i] && l.quantity !== (originalLines as OverrideLine[])[i].quantity
    );

  const productLines = (editableLines as OverrideLine[])
    .map(l => `  - ${PRODUCT_KEY_LABELS[l.productKey]}: ${l.quantity} × ${fmt(l.unitPrice)} = ${fmt(l.quantity * l.unitPrice)}`)
    .join('\n');

  const prompt = `You are writing an internal migration note for a Salesforce opportunity pricing migration at Orah.

Generate a concise bullet-list summary following exactly this structure. Use plain text (no markdown bold, no asterisks). Each section heading should be on its own line followed by bullet points.

Data:

Opportunity: ${opportunityName}
Renewal date: ${renewalDate ?? 'not set'}
Currency: ${currency}

Raw inputs:
- Supervise licences: ${rawInputs?.superviseLicences ?? '—'}
- Nurture licences: ${rawInputs?.nurtureLicences ?? '—'}
- Use case: ${rawInputs?.superviseUseCase ?? '—'}
- Attendance Rolls Scheduled (L90d): ${rawInputs?.attendanceRollsL90d ?? '—'}

Step 1 — Platform:
- Rule applied: ${step1?.conditions?.ruleApplied} (${
    step1?.conditions?.ruleApplied === 1 ? 'scheduled_rolls active with L90d > 0'
    : step1?.conditions?.ruleApplied === 2 ? 'use-case is Boarding Only'
    : 'default'
  })
- Platform: ${step1?.platform}

Step 2 — Tier:
- Products mapped: ${step2?.productTierMapping?.map((m: {productName: string; tier: string}) => `${m.productName} → ${m.tier}`).join(', ')}
- Resolved tier: ${step2?.tier}
${step2?.hasManualReview ? '- Contains Custom Subscription Fee — manual review' : ''}

Step 3 — Quantities:
- Platform licences: ${step3?.quantities?.platformLicences}
${step3?.quantities?.nurtureAddonQuantity > 0 ? `- Nurture add-on: ${step3.quantities.nurtureAddonQuantity}` : ''}
${step3?.quantities?.boardingAddonQuantity > 0 ? `- Boarding add-on: ${step3.quantities.boardingAddonQuantity}` : ''}
${step3?.notes?.length > 0 ? step3.notes.map((n: string) => `- Note: ${n}`).join('\n') : ''}

Step 4 — New Price (${currency}):
${productLines}
- Standard list price total: ${fmt(baseTotal)}
${matchAutoRenewal ? `- Priced to match auto-renewal amount: ${fmt(autoRenewalBaseline)}` : ''}
${linesChanged ? '- Products/quantities were manually adjusted from the calculated values' : ''}

Step 5 — Claims Gap:
${step5?.claimsGap?.gaps?.length === 0 ? '- No claim gaps' : `- ${step5?.claimsGap?.gaps?.length} gap(s): ${step5?.claimsGap?.gaps?.join(', ')}`}

Step 6 — Final Outcome:
- Auto-renewal baseline: ${fmt(autoRenewalBaseline)}
- New model price: ${fmt(effectiveTotal)}
- Delta: ${step6?.delta >= 0 ? '+' : ''}${fmt(step6?.delta)}
- Status: ${step6?.status}
${step6?.status === 'Needs Review' ? step6?.notes?.filter((n: string) => !n.startsWith('Auto_Renewal') && !n.startsWith('Sunsetting') && !n.startsWith('scheduled_rolls')).map((n: string) => `- ${n}`).join('\n') : ''}

Now write the migration note. Use this exact format:

Input summary
- [key account/opportunity details in 1-2 bullets]

Step 1 — Platform Determination
- [brief explanation]

Step 2 — Tier Mapping
- [brief explanation]

Step 3 — Quantities
- [brief explanation]

Step 4 — New Price (${currency})
- [list products with qty × price = total]
- Total: [amount]
${matchAutoRenewal || linesChanged ? '- [note any adjustments]' : ''}

Step 5 — Claims Gap Analysis
- [brief explanation]

Step 6 — Final Outcome
- [baseline, new price, delta, status]
${step6?.status === 'Needs Review' ? '- [review reasons]' : ''}

Be factual and concise. Each bullet should be one line. Do not use markdown formatting (no ** or ##).`;

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return NextResponse.json({ notes: text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate notes' },
      { status: 500 }
    );
  }
}
