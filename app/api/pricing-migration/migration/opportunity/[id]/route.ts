import { NextRequest, NextResponse } from 'next/server';
import { getConnectionFromCookie } from '@/lib/pricing-migration/salesforce';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const conn = await getConnectionFromCookie();
  if (!conn) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await conn.query<{
      Id: string;
      Order_Notes__c: string | null;
      Renewal_Products_Approved__c: boolean | null;
    }>(
      `SELECT Id, Order_Notes__c, Renewal_Products_Approved__c
       FROM Opportunity
       WHERE Id = '${id}'
       LIMIT 1`
    );

    if (result.records.length === 0) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opp = result.records[0];
    return NextResponse.json({
      orderNotes: opp.Order_Notes__c ?? null,
      renewalProductsConfirmed: opp.Renewal_Products_Approved__c ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
