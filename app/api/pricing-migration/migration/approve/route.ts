import { NextRequest, NextResponse } from 'next/server';
import { getConnectionFromCookie } from '@/lib/pricing-migration/salesforce';
import { PRODUCT_IDS } from '@/lib/pricing-migration/data/pricelist';
import type { MigrationResult } from '@/lib/pricing-migration/migration/types';

const SUPERVISE_PRICEBOOK_ID = process.env.SF_SUPERVISE_PRICEBOOK_ID ?? '01sQ900000eAYUPIA4';
const BOARDING_PRICEBOOK_ID = process.env.SF_BOARDING_PRICEBOOK_ID ?? '01sQ900000eAP9PIAW';

interface OverrideLine {
  productKey: keyof typeof PRODUCT_IDS;
  quantity: number;
  unitPrice: number;
}

interface ApproveRequest {
  migrationResult: MigrationResult;
  overrideLines?: OverrideLine[];
}

export async function POST(req: NextRequest) {
  const conn = await getConnectionFromCookie();
  if (!conn) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body: ApproveRequest = await req.json();
  const { migrationResult, overrideLines } = body;
  const { opportunityId, renewalDate, dbAccountExtId, step1, step2, step3, step4, step6, currency } = migrationResult;

  const platform = step1.platform;
  const newPricebookId = platform === 'Supervise' ? SUPERVISE_PRICEBOOK_ID : BOARDING_PRICEBOOK_ID;

  try {
    // Build the list of products + quantities needed
    interface LineItemSpec {
      productKey: keyof typeof PRODUCT_IDS;
      quantity: number;
      overrideUnitPrice?: number; // when set, used as-is instead of scale/discount logic
    }
    const needed: LineItemSpec[] = [];

    if (overrideLines && overrideLines.length > 0) {
      // User manually edited Step 4 — use their exact products, quantities, and unit prices
      for (const l of overrideLines) {
        needed.push({ productKey: l.productKey, quantity: l.quantity, overrideUnitPrice: l.unitPrice });
      }
    } else {
      // Derive from migration result
      if (platform === 'Supervise') {
        const tierKey: keyof typeof PRODUCT_IDS =
          step2.tier === 'Basic' ? 'SuperviseBasic'
          : step2.tier === 'Elite' ? 'SuperviseElite'
          : 'SupervisePro';

        needed.push({ productKey: tierKey, quantity: step3.quantities.platformLicences });

        if (step3.quantities.nurtureAddonQuantity > 0) {
          needed.push({ productKey: 'AddonNurture', quantity: step3.quantities.nurtureAddonQuantity });
        }
        if (step3.quantities.boardingAddonQuantity > 0) {
          needed.push({ productKey: 'AddonBoarding', quantity: step3.quantities.boardingAddonQuantity });
        }
      } else {
        const tierKey: keyof typeof PRODUCT_IDS = step2.tier === 'Core' ? 'BoardingCore' : 'BoardingPro';
        needed.push({ productKey: tierKey, quantity: step3.quantities.platformLicences });

        if (step3.quantities.nurtureAddonQuantity > 0 && step2.tier === 'Core') {
          needed.push({ productKey: 'AddonNurture', quantity: step3.quantities.nurtureAddonQuantity });
        }
      }
    }

    // Resolve each PricebookEntry by pricebook ID + Product2Id + currency
    const productIdList = [...new Set(needed.map(n => `'${PRODUCT_IDS[n.productKey]}'`))].join(', ');
    const pbeResult = await conn.query<{ Id: string; Product2Id: string; UnitPrice: number }>(
      `SELECT Id, Product2Id, UnitPrice
       FROM PricebookEntry
       WHERE Pricebook2Id = '${newPricebookId}'
         AND CurrencyIsoCode = '${currency}'
         AND Product2Id IN (${productIdList})
         AND IsActive = true`
    );

    const pbeByProductId: Record<string, { id: string; unitPrice: number }> = {};
    for (const pbe of pbeResult.records) {
      pbeByProductId[pbe.Product2Id] = { id: pbe.Id, unitPrice: pbe.UnitPrice };
    }

    // Match needed items to resolved entries
    interface ResolvedLineItem {
      pricebookEntryId: string;
      quantity: number;
      listUnitPrice: number;
      overrideUnitPrice?: number;
      productKey: string;
    }
    const lineItems: ResolvedLineItem[] = [];
    const missingKeys: string[] = [];

    for (const item of needed) {
      const productId = PRODUCT_IDS[item.productKey];
      const pbe = pbeByProductId[productId];
      if (!pbe) {
        missingKeys.push(`${item.productKey} (${productId})`);
      } else {
        lineItems.push({
          pricebookEntryId: pbe.id,
          quantity: item.quantity,
          listUnitPrice: pbe.unitPrice,
          overrideUnitPrice: item.overrideUnitPrice,
          productKey: item.productKey,
        });
      }
    }

    if (missingKeys.length > 0) {
      return NextResponse.json({
        error: `PricebookEntry not found for: ${missingKeys.join(', ')} (pricebook: ${newPricebookId}, currency: ${currency})`,
      }, { status: 400 });
    }

    if (lineItems.length === 0) {
      return NextResponse.json({ error: 'No line items could be resolved — check PricebookEntry data' }, { status: 400 });
    }

    // Calculate grandfathered rate adjustment (only for non-override flows)
    let discountPct: number | null = null;
    let scaleFactor: number | null = null;

    if (!overrideLines || overrideLines.length === 0) {
      const newListPrice = step4.priceBreakdown.total;
      const baseline = step6.comparisonBaseline;

      if (newListPrice > 0 && baseline > 0) {
        if (newListPrice >= baseline) {
          discountPct = ((newListPrice - baseline) / newListPrice) * 100;
        } else {
          scaleFactor = baseline / newListPrice;
        }
      }
    }

    // 1. Delete existing OLIs (Salesforce requires this before pricebook can change)
    const existingOlis = await conn.query<{ Id: string }>(
      `SELECT Id FROM OpportunityLineItem WHERE OpportunityId = '${opportunityId}'`
    );
    if (existingOlis.records.length > 0) {
      const idsToDelete = existingOlis.records.map(r => r.Id);
      await conn.sobject('OpportunityLineItem').delete(idsToDelete);
    }

    // 2. Update opportunity pricebook only (fields updated separately via /api/migration/note)
    await conn.sobject('Opportunity').update({ Id: opportunityId, Pricebook2Id: newPricebookId });

    // 3. Create new OLIs
    const newOlis = lineItems.map(item => {
      let unitPrice: number;
      if (item.overrideUnitPrice !== undefined) {
        // User explicitly set this price — use it as-is
        unitPrice = item.overrideUnitPrice;
      } else {
        unitPrice = item.listUnitPrice;
        if (scaleFactor !== null) {
          unitPrice = item.listUnitPrice * scaleFactor;
        }
      }
      const unitPriceRounded = parseFloat(unitPrice.toFixed(2));

      const oli: Record<string, unknown> = {
        OpportunityId: opportunityId,
        PricebookEntryId: item.pricebookEntryId,
        Quantity: item.quantity,
        UnitPrice: unitPriceRounded,
        Price__c: unitPriceRounded,
        ServiceDate: renewalDate,
        Duration__c: 'Use Contract Dates',
        Pricing_Method__c: 'Standard',
        DB_Account_ExtID__c: dbAccountExtId,
      };

      if (discountPct !== null && discountPct > 0 && item.overrideUnitPrice === undefined) {
        oli.Discount = parseFloat(discountPct.toFixed(4));
      }

      return oli;
    });

    const createResults = await conn.sobject('OpportunityLineItem').create(newOlis);
    const createArray = Array.isArray(createResults) ? createResults : [createResults];
    const createErrors = createArray
      .filter(r => !r.success)
      .flatMap(r => (r.errors ?? []).map((e: { message?: string }) => e.message ?? JSON.stringify(e)));

    if (createErrors.length > 0) {
      return NextResponse.json(
        { error: `Failed to create line items: ${createErrors.join('; ')}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, opportunityId, newPricebookId, lineItemCount: newOlis.length });
  } catch (err) {
    console.error('Approve error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
