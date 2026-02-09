export interface DaySchedule {
  open: string | null;
  close: string | null;
  closed: boolean;
}

export interface BusinessHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface BusinessSettings {
  id: string;
  tenantId: string;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  timezone: string | null;
  businessHours: BusinessHours | null;
  serviceArea: string | null;
  defaultDurationMinutes: number | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
