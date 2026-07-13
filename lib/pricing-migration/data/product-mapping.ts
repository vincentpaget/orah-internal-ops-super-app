export type SuperviseTier = 'Basic' | 'Pro' | 'Elite' | 'Requires Manual Review';
export type BoardingTier = 'Core' | 'Pro' | 'Requires Manual Review';

export interface TierMapping {
  superviseTier: SuperviseTier;
  boardingTier: BoardingTier;
}

// Source: Pricing Migration.xlsx — Migration Product Mapping sheet
export const PRODUCT_TIER_MAP: Record<string, TierMapping> = {
  'Supervise 1 (Starter)':       { superviseTier: 'Basic', boardingTier: 'Core' },
  'Supervise - Prep':            { superviseTier: 'Basic', boardingTier: 'Core' },
  'Supervise 2 (Pro)':           { superviseTier: 'Pro',   boardingTier: 'Core' },
  'Supervise - Prestige':        { superviseTier: 'Pro',   boardingTier: 'Core' },
  'Supervise - Elite':           { superviseTier: 'Elite', boardingTier: 'Pro'  },
  'Supervise 3 (Elite)':         { superviseTier: 'Elite', boardingTier: 'Pro'  },
  'Coordinate - Prep':           { superviseTier: 'Pro',   boardingTier: 'Core' },
  'Coordinate - Prestige':       { superviseTier: 'Pro',   boardingTier: 'Core' },
  'Coordinate - Elite':          { superviseTier: 'Pro',   boardingTier: 'Core' },
  'Safeguard - Prep':            { superviseTier: 'Elite', boardingTier: 'Pro'  },
  'Safeguard - Prestige':        { superviseTier: 'Elite', boardingTier: 'Pro'  },
  'Safeguard - Elite':           { superviseTier: 'Elite', boardingTier: 'Pro'  },
  'Connect - Beta':              { superviseTier: 'Pro',   boardingTier: 'Pro'  },
  'Connect 1 (Starter)':         { superviseTier: 'Pro',   boardingTier: 'Pro'  },
  'Connect 2 (Pro)':             { superviseTier: 'Pro',   boardingTier: 'Pro'  },
  'Connect - Prestige':          { superviseTier: 'Pro',   boardingTier: 'Pro'  },
  'Nurture 1 (Starter)':         { superviseTier: 'Basic', boardingTier: 'Core' },
  'Nurture - Prep':              { superviseTier: 'Basic', boardingTier: 'Core' },
  'Nurture - Prestige':          { superviseTier: 'Basic', boardingTier: 'Pro'  },
  'Nurture 2 (Pro)':             { superviseTier: 'Basic', boardingTier: 'Pro'  },
  'Nurture - Elite':             { superviseTier: 'Basic', boardingTier: 'Pro'  },
  'Open API':                    { superviseTier: 'Requires Manual Review', boardingTier: 'Requires Manual Review' },
  'Blackbaud Integration':       { superviseTier: 'Basic', boardingTier: 'Core' },
  'Platform - Standard':         { superviseTier: 'Basic', boardingTier: 'Core' },
  'Platform Pro':                { superviseTier: 'Pro',   boardingTier: 'Pro'  },
  'Platform - Professional':     { superviseTier: 'Pro',   boardingTier: 'Pro'  },
  'Wonde Integration':           { superviseTier: 'Pro',   boardingTier: 'Core' },
  'Unify - Prep':                { superviseTier: 'Pro',   boardingTier: 'Core' },
  'Unify - Prestige':            { superviseTier: 'Pro',   boardingTier: 'Core' },
  'Unify - Elite':               { superviseTier: 'Pro',   boardingTier: 'Core' },
  'Magnus Health Integration':   { superviseTier: 'Pro',   boardingTier: 'Core' },
  'Custom Subscription Fee':     { superviseTier: 'Requires Manual Review', boardingTier: 'Requires Manual Review' },
};

export const SUPERVISE_TIER_RANK: Record<SuperviseTier, number> = {
  'Basic': 1, 'Pro': 2, 'Elite': 3, 'Requires Manual Review': 99,
};

export const BOARDING_TIER_RANK: Record<BoardingTier, number> = {
  'Core': 1, 'Pro': 2, 'Requires Manual Review': 99,
};
