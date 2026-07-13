import { NextResponse } from 'next/server';
import { getConnectionFromCookie } from '@/lib/pricing-migration/salesforce';
import type { DBAccount, Transaction } from '@/lib/pricing-migration/migration/types';

function inClause(ids: string[]): string {
  return ids.map(id => `'${id}'`).join(', ');
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const conn = await getConnectionFromCookie();
  if (!conn) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;

  try {
    // 1. Fetch contract + its account ID
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
      saasoptics__customer_salesforce_id__c: string | null;
    }>(`SELECT Id, Name, Contract_Status__c,
              Contract_Start_Date__c, Contract_End_Date__c,
              Total_Local_ARR_at_EOM__c, Total_Local_CARR__c,
              saasoptics__register_currency_code__c, CurrencyIsoCode,
              saasoptics__customer_salesforce_id__c
       FROM saasoptics__contract__c WHERE Id = '${id}' LIMIT 1`);

    if (contractResult.records.length === 0) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const contract = contractResult.records[0];
    const accountId = contract.saasoptics__customer_salesforce_id__c;

    // 2. Fetch account name
    let accountName = '';
    if (accountId) {
      const acctResult = await conn.query<{ Id: string; Name: string }>(
        `SELECT Id, Name FROM Account WHERE Id = '${accountId}' LIMIT 1`
      );
      accountName = acctResult.records[0]?.Name ?? '';
    }

    // 3. Fetch all active transactions for this contract
    const txResult = await conn.query<{
      Id: string;
      saasoptics__item_name__c: string;
      saasoptics__item_code__c: string;
      saasoptics__tx_local_arr__c: number | null;
      saasoptics__register_currency_code__c: string;
      Student_Profiles__c: number | null;
      DB_Account__c: string | null;
      DB_Ext_ID__c: string | null;
    }>(`SELECT Id, saasoptics__item_name__c, saasoptics__item_code__c,
              saasoptics__tx_local_arr__c, saasoptics__register_currency_code__c,
              Student_Profiles__c, DB_Account__c, DB_Ext_ID__c
       FROM saasoptics__transaction__c
       WHERE saasoptics__contract_salesforce_id__c = '${id}'
         AND Non_Recurring__c = false
         AND saasoptics__tx_canceled__c = false
         AND saasoptics__tx_renewed_by__c = null`);

    // 4. Group transactions by DB_Account__c ID
    const linkedTx = txResult.records.filter(tx => tx.DB_Account__c != null);
    const unlinkedTx = txResult.records.filter(tx => tx.DB_Account__c == null);

    const dbAccountIds = [...new Set(linkedTx.map(tx => tx.DB_Account__c as string))];

    // 5. Batch fetch DB Account records
    const dbAccountMap = new Map<string, DBAccount>();
    if (dbAccountIds.length > 0) {
      const dbAcctResult = await conn.query<{
        Id: string;
        Analytics_Group_ID__c: string;
        Supervise_Licences__c: number | null;
        Nurture_Licences__c: number | null;
        Supervise_Use_Case__c: string | null;
        Attendance_Rolls_Scheduled_L90d__c: number | null;
        Allowed_Claims_Array__c: string | null;
        Local_ARR__c: number | null;
        Home_ARR__c: number | null;
        Local_CARR__c: number | null;
        Home_CARR__c: number | null;
        Active_Student_Profiles__c: number | null;
      }>(`SELECT Id, Analytics_Group_ID__c, Supervise_Licences__c, Nurture_Licences__c,
                Supervise_Use_Case__c, Attendance_Rolls_Scheduled_L90d__c,
                Allowed_Claims_Array__c, Local_ARR__c, Home_ARR__c,
                Local_CARR__c, Home_CARR__c, Active_Student_Profiles__c
         FROM DB_Account__c
         WHERE Id IN (${inClause(dbAccountIds)})`);

      for (const raw of dbAcctResult.records) {
        dbAccountMap.set(raw.Id, {
          id: raw.Id,
          analyticsGroupId: raw.Analytics_Group_ID__c,
          superviseLicences: raw.Supervise_Licences__c,
          nurtureLicences: raw.Nurture_Licences__c,
          superviseUseCase: raw.Supervise_Use_Case__c as DBAccount['superviseUseCase'],
          attendanceRollsScheduledL90d: raw.Attendance_Rolls_Scheduled_L90d__c,
          allowedClaimsArray: raw.Allowed_Claims_Array__c,
          localArr: raw.Local_ARR__c,
          homeArr: raw.Home_ARR__c,
          localCarr: raw.Local_CARR__c,
          homeCarr: raw.Home_CARR__c,
          activeStudentProfiles: raw.Active_Student_Profiles__c,
        });
      }
    }

    // 6. Build DB Account groups
    const dbAccountGroups = dbAccountIds.map(dbAcctId => {
      const dbAccount = dbAccountMap.get(dbAcctId) ?? null;
      const transactions: Transaction[] = linkedTx
        .filter(tx => tx.DB_Account__c === dbAcctId)
        .map(tx => ({
          id: tx.Id,
          currencyCode: tx.saasoptics__register_currency_code__c,
          itemName: tx.saasoptics__item_name__c,
          itemCode: tx.saasoptics__item_code__c,
          localArr: tx.saasoptics__tx_local_arr__c,
          studentProfiles: tx.Student_Profiles__c,
          dbAccountId: dbAcctId,
          dbAccountExtId: tx.DB_Ext_ID__c,
        }));
      return { dbAccountId: dbAcctId, dbAccount, transactions };
    });

    const unlinkedTransactions: Transaction[] = unlinkedTx.map(tx => ({
      id: tx.Id,
      currencyCode: tx.saasoptics__register_currency_code__c,
      itemName: tx.saasoptics__item_name__c,
      itemCode: tx.saasoptics__item_code__c,
      localArr: tx.saasoptics__tx_local_arr__c,
      studentProfiles: tx.Student_Profiles__c,
      dbAccountId: '',
      dbAccountExtId: tx.DB_Ext_ID__c,
    }));

    return NextResponse.json({
      contractId: id,
      contractName: contract.Name,
      contractStatus: contract.Contract_Status__c,
      startDate: contract.Contract_Start_Date__c,
      endDate: contract.Contract_End_Date__c,
      currency: contract.saasoptics__register_currency_code__c || contract.CurrencyIsoCode,
      accountId,
      accountName,
      instanceUrl: conn.instanceUrl,
      dbAccountGroups,
      unlinkedTransactions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
