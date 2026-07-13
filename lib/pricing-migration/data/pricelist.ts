// Source: Pricing Migration.xlsx — Pricelist sheet
// All prices are per-student/per-year unless noted as flat fee

export type Currency = 'USD' | 'GBP' | 'AUD' | 'NZD' | 'EUR' | 'CAD';
export const CURRENCIES: Currency[] = ['USD', 'GBP', 'AUD', 'NZD', 'EUR', 'CAD'];

export type PriceMap = Record<Currency, number>;

// Supervise platform tiers (per student/year)
export const SUPERVISE_TIER_PRICES: Record<'Basic' | 'Pro' | 'Elite', PriceMap> = {
  Basic: { USD: 5,  GBP: 4,  AUD: 7,  NZD: 8,  EUR: 4,  CAD: 7  },
  Pro:   { USD: 23, GBP: 17, AUD: 32, NZD: 38, EUR: 19, CAD: 31 },
  Elite: { USD: 30, GBP: 23, AUD: 42, NZD: 50, EUR: 25, CAD: 41 },
};

// Boarding platform tiers (per boarder/year)
export const BOARDING_TIER_PRICES: Record<'Core' | 'Pro', PriceMap> = {
  Core: { USD: 18, GBP: 14, AUD: 25, NZD: 30, EUR: 15, CAD: 24 },
  Pro:  { USD: 33, GBP: 25, AUD: 46, NZD: 54, EUR: 28, CAD: 45 },
};

// Add-on prices (per student/year)
export const ADDON_PRICES = {
  Boarding:           { USD: 5,    GBP: 4,    AUD: 7,    NZD: 8,    EUR: 4,    CAD: 7    } as PriceMap,
  Nurture:            { USD: 6,    GBP: 5,    AUD: 8,    NZD: 10,   EUR: 5,    CAD: 8    } as PriceMap,
  AutomatedAttendance:{ USD: 6,    GBP: 5,    AUD: 8,    NZD: 10,   EUR: 5,    CAD: 8    } as PriceMap,
  Dismissals:         { USD: 6,    GBP: 5,    AUD: 8,    NZD: 10,   EUR: 5,    CAD: 8    } as PriceMap,
  OpenAPI:            { USD: 1500, GBP: 1125, AUD: 2100, NZD: 2475, EUR: 1260, CAD: 2040 } as PriceMap, // flat fee
};

// Product codes used to match PricebookEntry records in Salesforce at runtime
export const PRODUCT_CODES = {
  SuperviseBasic:       'SP_Supervise1_24Q3',
  SupervisePro:         'SP_Supervise2_24Q3',
  SuperviseElite:       'SP_Supervise3_24Q3',
  BoardingCore:         'SP_BoardingCore_26Q1',
  BoardingPro:          'SP_BoardingPro_26Q1',
  AddonBoarding:        'SA_Boarding_26Q1',
  AddonNurture:         'SA_Nurture_26Q1',
  AddonAutoAttendance:  'SA_AutoAttend_26Q1',
  AddonDismissals:      'SA_Dismissals_26Q1',
  AddonOpenAPI:         'ADMIN_Open API',
} as const;

// Salesforce Product2 IDs — used to look up PricebookEntry by Product2Id + pricebook + currency
export const PRODUCT_IDS = {
  SuperviseBasic:       '01tQ9000005EZO1IAO',
  SupervisePro:         '01tQ9000005EZO2IAO',
  SuperviseElite:       '01tQ9000005EZO3IAO',
  BoardingCore:         '01tQ900000u9AkjIAE',
  BoardingPro:          '01tQ900000u9AkkIAE',
  AddonBoarding:        '01tQ900000u9AkfIAE',
  AddonNurture:         '01tQ900000u9AkiIAE',
  AddonAutoAttendance:  '01tQ900000u9AkgIAE',
  AddonDismissals:      '01tQ900000u9AkhIAE',
  AddonOpenAPI:         '01t7F000007wuMiQAI',
} as const;
