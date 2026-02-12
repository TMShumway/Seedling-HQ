export const VISIT_STATUSES = ['scheduled', 'en_route', 'started', 'completed', 'cancelled'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];
