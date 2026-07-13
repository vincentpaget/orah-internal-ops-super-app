import { NextRequest, NextResponse } from 'next/server';
import { getConnectionFromCookie } from '@/lib/pricing-migration/salesforce';
import { runMigration } from '@/lib/pricing-migration/migration/run-migration';
import type { DBAccount, RenewalOpportunity, Transaction } from '@/lib/pricing-migration/migration/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conn = await getConnectionFromCookie();
  if (!conn) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const oppResult = await conn.query<{
      Id: string;
      Name: string;
      StageName: string;
      Contract_Start_Date__c: string | null;
      CloseDate: string;
      OwnerId: string;
      Pricebook2Id: string | null;
      Auto_Renewal_Amount__c: number | null;
      CurrencyIsoCode: string;
      ARR_Basis__c: number | null;
    }>(
      `SELECT Id, Name, StageName, Contract_Start_Date__c, CloseDate, OwnerId, Pricebook2Id,
              Auto_Renewal_Amount__c, CurrencyIsoCode, ARR_Basis__c
       FROM Opportunity WHERE Id = '${id}' LIMIT 1`
    );

    if (oppResult.records.length === 0) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opp = oppResult.records[0];

    const oliResult = await conn.query<{ Id: string; DB_Account_ExtID__c: string | null }>(
      `SELECT Id, DB_Account_ExtID__c FROM OpportunityLineItem WHERE OpportunityId = '${id}'`
    );

    const extIds = [
      ...new Set(
        oliResult.records
          .map(oli => oli.DB_Account_ExtID__c)
          .filter((eid): eid is string => eid != null)
      ),
    ];

    const hasUnlinkedLineItems = oliResult.records.some(oli => !oli.DB_Account_ExtID__c);
    const multipleDbAccounts = extIds.length > 1;

    if (extIds.length === 0) {
      return NextResponse.json({
        error: hasUnlinkedLineItems
          ? 'One or more line items have no DB_Account_ExtID__c — manual review required'
          : 'No OpportunityLineItems found',
      }, { status: 400 });
    }

    const renewal: RenewalOpportunity = {
      id: opp.Id,
      name: opp.Name,
      stageName: opp.StageName,
      type: null,
      contractStartDate: opp.Contract_Start_Date__c,
      closeDate: opp.CloseDate,
      ownerId: opp.OwnerId,
      pricebook2Id: opp.Pricebook2Id,
      autoRenewalAmount: opp.Auto_Renewal_Amount__c,
      currencyIsoCode: opp.CurrencyIsoCode,
      arrBasis: opp.ARR_Basis__c,
      bookedArr: null,
      netArr: null,
      managedAccounts: null,
      doNotAutoRenew: null,
      orderNotes: null,
      renewalProductsConfirmed: null,
    };

    const results = [];

    for (const extId of extIds) {
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
      }>(
        `SELECT Id, Analytics_Group_ID__c, Supervise_Licences__c, Nurture_Licences__c,
                Supervise_Use_Case__c, Attendance_Rolls_Scheduled_L90d__c,
                Allowed_Claims_Array__c, Local_ARR__c, Home_ARR__c,
                Local_CARR__c, Home_CARR__c, Active_Student_Profiles__c
         FROM DB_Account__c
         WHERE Analytics_Group_ID__c = '${extId}'
         LIMIT 1`
      );

      if (dbAcctResult.records.length === 0) {
        return NextResponse.json({
          error: `DB Account with Analytics_Group_ID__c = '${extId}' not found`,
        }, { status: 400 });
      }

      const raw = dbAcctResult.records[0];
      const account: DBAccount = {
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
      };

      const txResult = await conn.query<{
        Id: string;
        saasoptics__register_currency_code__c: string;
        saasoptics__item_name__c: string;
        saasoptics__item_code__c: string;
        saasoptics__tx_local_arr__c: number | null;
        Student_Profiles__c: number | null;
        DB_Ext_ID__c: string | null;
      }>(
        `SELECT Id, saasoptics__register_currency_code__c, saasoptics__item_name__c,
                saasoptics__item_code__c, saasoptics__tx_local_arr__c,
                Student_Profiles__c, DB_Ext_ID__c
         FROM saasoptics__transaction__c
         WHERE DB_Ext_ID__c = '${extId}'
           AND Non_Recurring__c = false
           AND saasoptics__tx_canceled__c = false
           AND saasoptics__tx_renewed_by__c = null`
      );

      const transactions: Transaction[] = txResult.records.map(tx => ({
        id: tx.Id,
        currencyCode: tx.saasoptics__register_currency_code__c,
        itemName: tx.saasoptics__item_name__c,
        itemCode: tx.saasoptics__item_code__c,
        localArr: tx.saasoptics__tx_local_arr__c,
        studentProfiles: tx.Student_Profiles__c,
        dbAccountId: raw.Id,
        dbAccountExtId: tx.DB_Ext_ID__c,
      }));

      const result = runMigration(account, renewal, transactions, multipleDbAccounts);
      results.push(result);
    }

    return NextResponse.json({ results, instanceUrl: conn.instanceUrl });
  } catch (err) {
    console.error('Migration run (single) error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
