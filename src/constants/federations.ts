import type { FederationName } from '../db/db';

export const FEDERATION_ABBR: Record<FederationName, string> = {
  'North America Boxing Federation': 'NABF',
  'South America Boxing Federation': 'SABF',
  'African Boxing Federation':       'ABF',
  'European Boxing Federation':      'EBF',
  'Asia Boxing Federation':          'AsBF',
  'Oceania Boxing Federation':       'OBF',
  'International Boxing Federation': 'IBF',
};

// Fixed week offsets per federation. IBF is quarterly (prestige). SABF/ABF have 3 events
// (lower prestige). AsBF/OBF include early-year slots (weeks 2 and 5) which are skipped
// at runtime when they fall outside the target year's bounds.
export const FEDERATION_WEEKS: Record<FederationName, number[]> = {
  'International Boxing Federation': [10, 23, 36, 49],
  'North America Boxing Federation': [4, 17, 30, 43],
  'European Boxing Federation':      [6, 19, 32, 45],
  'South America Boxing Federation': [8, 21, 34],
  'African Boxing Federation':       [12, 25, 38],
  'Asia Boxing Federation':          [15, 28, 41, 2],
  'Oceania Boxing Federation':       [18, 31, 44, 5],
};
