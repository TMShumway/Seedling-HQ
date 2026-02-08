export const ROLES = ['owner', 'admin', 'member'] as const;
export type Role = (typeof ROLES)[number];
