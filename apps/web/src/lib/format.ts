export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

const UNIT_TYPE_LABELS: Record<string, string> = {
  flat: 'Flat Fee',
  hourly: 'Hourly',
  per_sqft: 'Per Sq Ft',
  per_unit: 'Per Unit',
  per_visit: 'Per Visit',
};

export function formatUnitType(unitType: string): string {
  return UNIT_TYPE_LABELS[unitType] ?? unitType;
}
