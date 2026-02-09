export const UNIT_TYPES = ['flat', 'hourly', 'per_sqft', 'per_unit', 'per_visit'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];
