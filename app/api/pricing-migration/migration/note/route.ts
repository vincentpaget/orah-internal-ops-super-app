import { NextRequest, NextResponse } from 'next/server';
import { getConnectionFromCookie } from '@/lib/pricing-migration/salesforce';

export async function POST(req: NextRequest) {
  const conn = await getConnectionFromCookie();
  if (!conn) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { opportunityId, renewalProductsConfirmed, orderNotes } = await req.json() as {
    opportunityId: string;
    renewalProductsConfirmed?: boolean;
    orderNotes?: string;
  };

  if (!opportunityId) {
    return NextResponse.json({ error: 'opportunityId is required' }, { status: 400 });
  }

  const fields: { Id: string; Renewal_Products_Approved__c?: boolean; Order_Notes__c?: string } = { Id: opportunityId };
  if (renewalProductsConfirmed !== undefined) fields.Renewal_Products_Approved__c = renewalProductsConfirmed;
  if (orderNotes !== undefined) fields.Order_Notes__c = orderNotes;

  try {
    const result = await conn.sobject('Opportunity').update(fields);
    const record = Array.isArray(result) ? result[0] : result;
    if (!record.success) {
      const errors = Array.isArray(record.errors)
        ? record.errors.map((e: { message?: string } | string) => (typeof e === 'string' ? e : e.message)).join('; ')
        : String(record.errors);
      return NextResponse.json({ error: `Update failed: ${errors}` }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
