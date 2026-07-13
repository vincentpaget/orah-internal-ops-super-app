import { NextResponse } from 'next/server';
import { getConnectionFromCookie } from '@/lib/pricing-migration/salesforce';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const conn = await getConnectionFromCookie();
  if (!conn) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;

  try {
    // 1. Fetch the SF Account
    const acctResult = await conn.query<{
      Id: string;
      Name: string;
      CurrencyIsoCode: string;
    }>(`SELECT Id, Name, CurrencyIsoCode FROM Account WHERE Id = '${id}' LIMIT 1`);

    if (acctResult.records.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const sfAccount = acctResult.records[0];

    // 2. Fetch all contracts for this account
    const contractResult = await conn.query<{
      Id: string;
      Name: string;
      Contract_Status__c: string | null;
      Contract_Start_Date__c: string | null;
      Contract_End_Date__c: string | null;
      Total_Local_ARR_at_EOM__c: number | null;
      Total_Local_CARR__c: number | null;
      saasoptics__register_currency_code__c: string | null;
      CurrencyIsoCode: string;
    }>(`SELECT Id, Name, Contract_Status__c,
              Contract_Start_Date__c, Contract_End_Date__c,
              Total_Local_ARR_at_EOM__c, Total_Local_CARR__c,
              saasoptics__register_currency_code__c, CurrencyIsoCode
       FROM saasoptics__contract__c
       WHERE saasoptics__customer_salesforce_id__c = '${id}'
       ORDER BY Contract_Start_Date__c DESC`);

    const contracts = contractResult.records.map(c => ({
      id: c.Id,
      name: c.Name,
      status: c.Contract_Status__c,
      startDate: c.Contract_Start_Date__c,
      endDate: c.Contract_End_Date__c,
      totalArr: c.Total_Local_ARR_at_EOM__c,
      totalCarr: c.Total_Local_CARR__c,
      currency: c.saasoptics__register_currency_code__c || c.CurrencyIsoCode || sfAccount.CurrencyIsoCode,
    }));

    return NextResponse.json({
      accountId: id,
      accountName: sfAccount.Name,
      instanceUrl: conn.instanceUrl,
      contracts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
