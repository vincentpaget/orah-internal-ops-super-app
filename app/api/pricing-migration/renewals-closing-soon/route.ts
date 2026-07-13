import { NextResponse } from 'next/server';
import { getConnectionFromCookie } from '@/lib/pricing-migration/salesforce';

export interface RenewalOpp {
  id: string;
  name: string;
  accountName: string;
  ownerName: string;
  stageName: string;
  closeDate: string;
  renewalDate: string | null;
  doNotAutoRenew: boolean;
  currency: string;
  arrBasis: number | null;
  autoRenewalAmount: number | null;
}

export async function GET() {
  const conn = await getConnectionFromCookie();
  if (!conn) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const result = await conn.query<{
      Id: string;
      Name: string;
      Account: { Name: string } | null;
      Owner: { Name: string } | null;
      StageName: string;
      CloseDate: string;
      Contract_Start_Date__c: string | null;
      Do_Not_Auto_Renew__c: boolean;
      CurrencyIsoCode: string;
      ARR_Basis__c: number | null;
      Auto_Renewal_Amount__c: number | null;
    }>(
      `SELECT Id, Name, Account.Name, Owner.Name, StageName, CloseDate,
              Contract_Start_Date__c, Do_Not_Auto_Renew__c,
              CurrencyIsoCode, ARR_Basis__c, Auto_Renewal_Amount__c
       FROM Opportunity
       WHERE IsClosed = false
         AND Record_Type_Name__c = 'Renewal'
         AND AccountId != '0017F00000XJtiAQAT'
       ORDER BY CloseDate DESC`
    );

    const opps: RenewalOpp[] = result.records.map(r => ({
      id: r.Id,
      name: r.Name,
      accountName: r.Account?.Name ?? '',
      ownerName: r.Owner?.Name ?? '',
      stageName: r.StageName,
      closeDate: r.CloseDate,
      renewalDate: r.Contract_Start_Date__c,
      doNotAutoRenew: r.Do_Not_Auto_Renew__c ?? false,
      currency: r.CurrencyIsoCode,
      arrBasis: r.ARR_Basis__c,
      autoRenewalAmount: r.Auto_Renewal_Amount__c,
    }));

    return NextResponse.json({ opps, instanceUrl: conn.instanceUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
