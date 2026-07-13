import { NextRequest, NextResponse } from 'next/server';
import { getConnectionFromCookie } from '@/lib/pricing-migration/salesforce';
import { runMigration } from '@/lib/pricing-migration/migration/run-migration';
import type { DBAccount, RenewalOpportunity, Transaction } from '@/lib/pricing-migration/migration/types';

const SUPERVISE_PRICEBOOK_ID = process.env.SF_SUPERVISE_PRICEBOOK_ID ?? '01sQ900000eAYUPIA4';
const BOARDING_PRICEBOOK_ID = process.env.SF_BOARDING_PRICEBOOK_ID ?? '01sQ900000eAP9PIAW';

function buildCloseDateClause(filter: string | null): string {
  if (!filter || filter === 'All') return '';
  if (filter === 'Past due') return 'AND CloseDate < TODAY';
  const days = filter === 'Next 7 days' ? 7 : filter === 'Next 30 days' ? 30 : filter === 'Next 60 days' ? 60 : filter === 'Next 90 days' ? 90 : 0;
  if (days > 0) return `AND CloseDate >= TODAY AND CloseDate <= NEXT_N_DAYS:${days}`;
  return '';
}

export async function GET(req: NextRequest) {
  const conn = await getConnectionFromCookie();
  if (!conn) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const closeDateClause = buildCloseDateClause(req.nextUrl.searchParams.get('closeDate'));

  try {
    // 1. Fetch all open Renewal opportunities not yet on the new pricebooks
    const oppResult = await conn.query<{
      Id: string;
      Name: string;
      StageName: string;
      Type: string | null;
      Contract_Start_Date__c: string | null;
      CloseDate: string;
      OwnerId: string;
      Pricebook2Id: string | null;
      Pricebook2: { Name: string } | null;
      Auto_Renewal_Amount__c: number | null;
      CurrencyIsoCode: string;
      ARR_Basis__c: number | null;
      Booked_ARR__c: number | null;
      Net_ARR__c: number | null;
      Account: { Managed_Accounts__c: number | null } | null;
      Do_Not_Auto_Renew__c: boolean | null;
      Order_Notes__c: string | null;
      Renewal_Products_Approved__c: boolean | null;
    }>(
      `SELECT Id, Name, StageName, Type, Contract_Start_Date__c, CloseDate, OwnerId, Pricebook2Id, Pricebook2.Name,
              Auto_Renewal_Amount__c, CurrencyIsoCode, ARR_Basis__c, Booked_ARR__c, Net_ARR__c,
              Account.Managed_Accounts__c, Do_Not_Auto_Renew__c,
              Order_Notes__c, Renewal_Products_Approved__c
       FROM Opportunity
       WHERE IsClosed = false
         AND Record_Type_Name__c = 'Renewal'
         AND (Pricebook2Id = null OR (Pricebook2Id != '${SUPERVISE_PRICEBOOK_ID}' AND Pricebook2Id != '${BOARDING_PRICEBOOK_ID}'))
         AND AccountId != '0017F00000XJtiAQAT'
         ${closeDateClause}`
    );

    const results = [];
    const pricebookNames: Record<string, string | null> = {};

    for (const opp of oppResult.records) {
      pricebookNames[opp.Id] = opp.Pricebook2?.Name ?? null;
      // 2. Get OLIs → distinct DB Account ExtIDs
      const oliResult = await conn.query<{
        Id: string;
        DB_Account_ExtID__c: string | null;
      }>(
        `SELECT Id, DB_Account_ExtID__c
         FROM OpportunityLineItem
         WHERE OpportunityId = '${opp.Id}'`
      );

      const extIds = [
        ...new Set(
          oliResult.records
            .map(oli => oli.DB_Account_ExtID__c)
            .filter((id): id is string => id != null)
        ),
      ];

      const hasUnlinkedLineItems = oliResult.records.some(oli => !oli.DB_Account_ExtID__c);
      const multipleDbAccounts = extIds.length > 1;

      if (extIds.length === 0) {
        // Flag opp with no DB Account linkage
        results.push({
          opportunityId: opp.Id,
          opportunityName: opp.Name,
          error: hasUnlinkedLineItems
            ? 'One or more line items have no DB_Account_ExtID__c — manual review required'
            : 'No OpportunityLineItems found',
        });
        continue;
      }

      const renewal: RenewalOpportunity = {
        id: opp.Id,
        name: opp.Name,
        stageName: opp.StageName,
        type: opp.Type ?? null,
        contractStartDate: opp.Contract_Start_Date__c,
        closeDate: opp.CloseDate,
        ownerId: opp.OwnerId,
        pricebook2Id: opp.Pricebook2Id,
        autoRenewalAmount: opp.Auto_Renewal_Amount__c,
        currencyIsoCode: opp.CurrencyIsoCode,
        arrBasis: opp.ARR_Basis__c,
        bookedArr: opp.Booked_ARR__c ?? null,
        netArr: opp.Net_ARR__c ?? null,
        managedAccounts: opp.Account?.Managed_Accounts__c ?? null,
        doNotAutoRenew: opp.Do_Not_Auto_Renew__c ?? null,
        orderNotes: opp.Order_Notes__c ?? null,
        renewalProductsConfirmed: opp.Renewal_Products_Approved__c ?? null,
      };

      for (const extId of extIds) {
        // 3. Look up the DB Account record
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
          results.push({
            opportunityId: opp.Id,
            opportunityName: opp.Name,
            error: `DB Account with Analytics_Group_ID__c = '${extId}' not found`,
          });
          continue;
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

        // 4. Fetch renewable transactions for this DB Account
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

        // 5. Run migration
        const result = runMigration(account, renewal, transactions, multipleDbAccounts);
        results.push(result);
      }
    }

    // Fetch open Renewal opps already on the new pricebooks
    const updatedOppResult = await conn.query<{
      Id: string;
      Name: string;
      StageName: string;
      Type: string | null;
      Contract_Start_Date__c: string | null;
      CloseDate: string;
      OwnerId: string;
      Auto_Renewal_Amount__c: number | null;
      CurrencyIsoCode: string;
      ARR_Basis__c: number | null;
      Booked_ARR__c: number | null;
      Net_ARR__c: number | null;
      Account: { Managed_Accounts__c: number | null } | null;
      Pricebook2Id: string;
      Pricebook2: { Name: string } | null;
      Do_Not_Auto_Renew__c: boolean | null;
      Renewal_Products_Approved__c: boolean | null;
      Order_Notes__c: string | null;
    }>(
      `SELECT Id, Name, StageName, Type, Contract_Start_Date__c, CloseDate, OwnerId, Auto_Renewal_Amount__c,
              CurrencyIsoCode, ARR_Basis__c, Booked_ARR__c, Net_ARR__c,
              Account.Managed_Accounts__c, Do_Not_Auto_Renew__c, Pricebook2Id, Pricebook2.Name,
              Renewal_Products_Approved__c, Order_Notes__c
       FROM Opportunity
       WHERE IsClosed = false
         AND Record_Type_Name__c = 'Renewal'
         AND (Pricebook2Id = '${SUPERVISE_PRICEBOOK_ID}' OR Pricebook2Id = '${BOARDING_PRICEBOOK_ID}')
         AND AccountId != '0017F00000XJtiAQAT'
         ${closeDateClause}`
    );

    // Enrich updated opps: batch-fetch OLIs (with Product2Id), full DB Accounts, and full Transactions
    let olisByOppId: Record<string, {
      productName: string; product2Id: string | null;
      quantity: number; unitPrice: number; totalPrice: number; dbAccountExtId: string | null;
    }[]> = {};
    let dbAccountsByExtId: Record<string, DBAccount> = {};
    let txsByExtId: Record<string, Transaction[]> = {};

    if (updatedOppResult.records.length > 0) {
      const updatedIds = updatedOppResult.records.map(o => `'${o.Id}'`).join(', ');
      const olisBatch = await conn.query<{
        OpportunityId: string;
        Product2: { Name: string } | null;
        Product2Id: string | null;
        Quantity: number;
        UnitPrice: number;
        TotalPrice: number;
        DB_Account_ExtID__c: string | null;
      }>(
        `SELECT OpportunityId, Product2.Name, Product2Id, Quantity, UnitPrice, TotalPrice, DB_Account_ExtID__c
         FROM OpportunityLineItem
         WHERE OpportunityId IN (${updatedIds})`
      );

      for (const oli of olisBatch.records) {
        if (!olisByOppId[oli.OpportunityId]) olisByOppId[oli.OpportunityId] = [];
        olisByOppId[oli.OpportunityId].push({
          productName: oli.Product2?.Name ?? '—',
          product2Id: oli.Product2Id,
          quantity: oli.Quantity,
          unitPrice: oli.UnitPrice,
          totalPrice: oli.TotalPrice,
          dbAccountExtId: oli.DB_Account_ExtID__c,
        });
      }

      const allExtIds = [...new Set(
        olisBatch.records
          .map(o => o.DB_Account_ExtID__c)
          .filter((eid): eid is string => eid != null)
      )];

      if (allExtIds.length > 0) {
        const extIdList = allExtIds.map(e => `'${e}'`).join(', ');

        const [dbAcctsBatch, txsBatch] = await Promise.all([
          conn.query<{
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
             WHERE Analytics_Group_ID__c IN (${extIdList})`
          ),
          conn.query<{
            Id: string;
            saasoptics__item_name__c: string;
            saasoptics__item_code__c: string;
            saasoptics__tx_local_arr__c: number | null;
            saasoptics__register_currency_code__c: string;
            Student_Profiles__c: number | null;
            DB_Ext_ID__c: string | null;
          }>(
            `SELECT Id, saasoptics__item_name__c, saasoptics__item_code__c,
                    saasoptics__tx_local_arr__c, saasoptics__register_currency_code__c,
                    Student_Profiles__c, DB_Ext_ID__c
             FROM saasoptics__transaction__c
             WHERE DB_Ext_ID__c IN (${extIdList})
               AND Non_Recurring__c = false
               AND saasoptics__tx_canceled__c = false
               AND saasoptics__tx_renewed_by__c = null`
          ),
        ]);

        for (const r of dbAcctsBatch.records) {
          dbAccountsByExtId[r.Analytics_Group_ID__c] = {
            id: r.Id,
            analyticsGroupId: r.Analytics_Group_ID__c,
            superviseLicences: r.Supervise_Licences__c,
            nurtureLicences: r.Nurture_Licences__c,
            superviseUseCase: r.Supervise_Use_Case__c as DBAccount['superviseUseCase'],
            attendanceRollsScheduledL90d: r.Attendance_Rolls_Scheduled_L90d__c,
            allowedClaimsArray: r.Allowed_Claims_Array__c,
            localArr: r.Local_ARR__c,
            homeArr: r.Home_ARR__c,
            localCarr: r.Local_CARR__c,
            homeCarr: r.Home_CARR__c,
            activeStudentProfiles: r.Active_Student_Profiles__c,
          };
        }
        for (const tx of txsBatch.records) {
          const eid = tx.DB_Ext_ID__c ?? '';
          if (!txsByExtId[eid]) txsByExtId[eid] = [];
          const dbAcct = dbAccountsByExtId[eid];
          txsByExtId[eid].push({
            id: tx.Id,
            currencyCode: tx.saasoptics__register_currency_code__c,
            itemName: tx.saasoptics__item_name__c,
            itemCode: tx.saasoptics__item_code__c,
            localArr: tx.saasoptics__tx_local_arr__c,
            studentProfiles: tx.Student_Profiles__c,
            dbAccountId: dbAcct?.id ?? '',
            dbAccountExtId: tx.DB_Ext_ID__c,
          });
        }
      }
    }

    const updatedOpps = updatedOppResult.records.map(opp => {
      const oppOlis = olisByOppId[opp.Id] ?? [];
      const extIds = [...new Set(oppOlis.map(o => o.dbAccountExtId).filter((e): e is string => e != null))];
      const firstExtId = extIds[0];
      const multipleDbAccounts = extIds.length > 1;

      const platform: 'Supervise' | 'Boarding' = opp.Pricebook2Id === SUPERVISE_PRICEBOOK_ID ? 'Supervise' : 'Boarding';

      // Run migration engine so we get tier mapping, claims analysis, platform logic
      let migrationResult = null;
      if (firstExtId && dbAccountsByExtId[firstExtId]) {
        const account = dbAccountsByExtId[firstExtId];
        const transactions = txsByExtId[firstExtId] ?? [];
        const renewal: RenewalOpportunity = {
          id: opp.Id,
          name: opp.Name,
          stageName: opp.StageName,
          type: opp.Type ?? null,
          contractStartDate: opp.Contract_Start_Date__c,
          closeDate: opp.CloseDate,
          ownerId: opp.OwnerId,
          pricebook2Id: opp.Pricebook2Id,
          autoRenewalAmount: opp.Auto_Renewal_Amount__c,
          currencyIsoCode: opp.CurrencyIsoCode,
          arrBasis: opp.ARR_Basis__c,
          bookedArr: opp.Booked_ARR__c ?? null,
          netArr: opp.Net_ARR__c ?? null,
          managedAccounts: opp.Account?.Managed_Accounts__c ?? null,
          doNotAutoRenew: opp.Do_Not_Auto_Renew__c ?? null,
          orderNotes: opp.Order_Notes__c ?? null,
          renewalProductsConfirmed: opp.Renewal_Products_Approved__c ?? null,
        };
        migrationResult = runMigration(account, renewal, transactions, multipleDbAccounts);
      }

      pricebookNames[opp.Id] = opp.Pricebook2?.Name ?? null;

      return {
        opportunityId: opp.Id,
        opportunityName: opp.Name,
        stageName: opp.StageName,
        type: opp.Type ?? null,
        renewalDate: opp.Contract_Start_Date__c,
        closeDate: opp.CloseDate,
        currency: opp.CurrencyIsoCode,
        arrBasis: opp.ARR_Basis__c,
        bookedArr: opp.Booked_ARR__c ?? null,
        netArr: opp.Net_ARR__c ?? null,
        managedAccounts: opp.Account?.Managed_Accounts__c ?? null,
        doNotAutoRenew: opp.Do_Not_Auto_Renew__c ?? null,
        autoRenewalAmount: opp.Auto_Renewal_Amount__c,
        platform,
        alreadyUpdated: true as const,
        renewalProductsConfirmed: opp.Renewal_Products_Approved__c ?? null,
        migrationResult,
        currentOlis: oppOlis,
      };
    });

    return NextResponse.json({ results, updatedOpps, pricebookNames, instanceUrl: conn.instanceUrl });
  } catch (err) {
    console.error('Migration run error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
