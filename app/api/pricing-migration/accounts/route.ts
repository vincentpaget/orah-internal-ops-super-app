import { NextResponse } from 'next/server';
import { getConnectionFromCookie } from '@/lib/pricing-migration/salesforce';

const SUPERVISE_PRICEBOOK_ID = process.env.SF_SUPERVISE_PRICEBOOK_ID ?? '01sQ900000eAYUPIA4';
const BOARDING_PRICEBOOK_ID  = process.env.SF_BOARDING_PRICEBOOK_ID  ?? '01sQ900000eAP9PIAW';
const NEW_PRICEBOOK_IDS = new Set([SUPERVISE_PRICEBOOK_ID, BOARDING_PRICEBOOK_ID]);

// Status priority for accounts with multiple contracts
const STATUS_PRIORITY: Record<string, number> = {
  active:    4,
  upcoming:  3,
  expired:   2,
  cancelled: 1,
  canceled:  1,
};

function inClause(ids: string[]): string {
  return ids.map(id => `'${id}'`).join(', ');
}

function primaryStatus(statuses: (string | null)[]): string | null {
  let best: string | null = null;
  let bestPriority = -1;
  for (const s of statuses) {
    const p = STATUS_PRIORITY[s?.toLowerCase() ?? ''] ?? 0;
    if (p > bestPriority) { bestPriority = p; best = s; }
  }
  return best;
}

export async function GET() {
  const conn = await getConnectionFromCookie();
  if (!conn) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // 1. Fetch all contracts to determine which accounts to show and their statuses
    const contractResult = await conn.query<{
      Id: string;
      saasoptics__customer_salesforce_id__c: string | null;
      Contract_Status__c: string | null;
      Contract_End_Date__c: string | null;
    }>(`SELECT Id, saasoptics__customer_salesforce_id__c,
              Contract_Status__c, Contract_End_Date__c
       FROM saasoptics__contract__c
       ORDER BY Contract_Start_Date__c DESC`);

    // Group contracts by account ID
    const contractsByAccount = new Map<string, typeof contractResult.records>();
    for (const c of contractResult.records) {
      const aid = c.saasoptics__customer_salesforce_id__c;
      if (!aid) continue;
      if (!contractsByAccount.has(aid)) contractsByAccount.set(aid, []);
      contractsByAccount.get(aid)!.push(c);
    }

    const accountIds = [...contractsByAccount.keys()];
    if (accountIds.length === 0) {
      return NextResponse.json({ accounts: [], instanceUrl: conn.instanceUrl });
    }

    // 2. Fetch accounts that have contracts
    const accountResult = await conn.query<{
      Id: string;
      Name: string;
      BillingCountry: string | null;
      CurrencyIsoCode: string;
      Success_Owner__c: string | null;
      Total_Home_CARR__c: number | null;
      Total_Local_CARR__c: number | null;
      Managed_Accounts__c: number | null;
      Last_Pricebook_ID__c: string | null;
      Open_Opps__c: number | null;
    }>(`SELECT Id, Name, BillingCountry, CurrencyIsoCode,
              Success_Owner__c, Total_Home_CARR__c, Total_Local_CARR__c,
              Managed_Accounts__c, Last_Pricebook_ID__c, Open_Opps__c
       FROM Account
       WHERE Id IN (${inClause(accountIds)})
       ORDER BY Name ASC`);

    const records = accountResult.records;

    // 3. Batch lookup pricebook names
    const pricebookIds = [...new Set(
      records.map(r => r.Last_Pricebook_ID__c).filter((id): id is string => id != null)
    )];
    const pricebookNames = new Map<string, string>();
    if (pricebookIds.length > 0) {
      const pbResult = await conn.query<{ Id: string; Name: string }>(
        `SELECT Id, Name FROM Pricebook2 WHERE Id IN (${inClause(pricebookIds)})`
      );
      for (const pb of pbResult.records) pricebookNames.set(pb.Id, pb.Name);
    }

    // 4. Batch lookup user names
    const userIds = [...new Set(
      records.map(r => r.Success_Owner__c).filter((id): id is string => id != null)
    )];
    const userNames = new Map<string, string>();
    if (userIds.length > 0) {
      const userResult = await conn.query<{ Id: string; Name: string }>(
        `SELECT Id, Name FROM User WHERE Id IN (${inClause(userIds)})`
      );
      for (const u of userResult.records) userNames.set(u.Id, u.Name);
    }

    // 5. Build response — derive contract status from actual contracts
    const accounts = records.map(r => {
      const contracts = contractsByAccount.get(r.Id) ?? [];
      const statuses = contracts.map(c => c.Contract_Status__c);
      const contractStatus = primaryStatus(statuses);

      // End date from the highest-priority contract
      const primaryContract = contracts.find(
        c => c.Contract_Status__c === contractStatus
      );
      const renewalDate = primaryContract?.Contract_End_Date__c ?? null;

      const isMigrated = r.Last_Pricebook_ID__c != null && NEW_PRICEBOOK_IDS.has(r.Last_Pricebook_ID__c);
      const openOpps = r.Open_Opps__c ?? 0;
      const isCancelled = contractStatus?.toLowerCase().includes('cancel') ?? false;

      let migrationStatus: 'Migrated' | 'In Progress' | 'Pending' | 'Not Applicable';
      if (isCancelled && contracts.every(c => c.Contract_Status__c?.toLowerCase().includes('cancel'))) {
        migrationStatus = 'Not Applicable';
      } else if (isMigrated) {
        migrationStatus = 'Migrated';
      } else if (openOpps > 0) {
        migrationStatus = 'In Progress';
      } else {
        migrationStatus = 'Pending';
      }

      const pricebookName = r.Last_Pricebook_ID__c
        ? (pricebookNames.get(r.Last_Pricebook_ID__c) ?? r.Last_Pricebook_ID__c)
        : null;

      const successOwnerName = r.Success_Owner__c
        ? (userNames.get(r.Success_Owner__c) ?? r.Success_Owner__c)
        : null;

      return {
        id: r.Id,
        name: r.Name,
        billingCountry: r.BillingCountry,
        currency: r.CurrencyIsoCode,
        contractStatus,
        renewalDate,
        contractCount: contracts.length,
        successOwner: successOwnerName,
        totalHomeCARR: r.Total_Home_CARR__c,
        totalLocalCARR: r.Total_Local_CARR__c,
        managedAccounts: r.Managed_Accounts__c,
        lastPricebookName: pricebookName,
        openOpps: r.Open_Opps__c,
        migrationStatus,
      };
    });

    return NextResponse.json({ accounts, instanceUrl: conn.instanceUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
