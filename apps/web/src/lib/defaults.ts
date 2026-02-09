import type { BusinessHoursResponse } from './api-client';

export const DEFAULT_BUSINESS_HOURS: BusinessHoursResponse = {
  monday: { open: '08:00', close: '17:00', closed: false },
  tuesday: { open: '08:00', close: '17:00', closed: false },
  wednesday: { open: '08:00', close: '17:00', closed: false },
  thursday: { open: '08:00', close: '17:00', closed: false },
  friday: { open: '08:00', close: '17:00', closed: false },
  saturday: { open: '09:00', close: '13:00', closed: false },
  sunday: { open: null, close: null, closed: true },
};

export const DEFAULT_TIMEZONE = 'America/New_York';

export const DEFAULT_DURATION_MINUTES = 60;

export const US_TIMEZONES = [
  { label: 'Eastern (ET)', value: 'America/New_York' },
  { label: 'Central (CT)', value: 'America/Chicago' },
  { label: 'Mountain (MT)', value: 'America/Denver' },
  { label: 'Pacific (PT)', value: 'America/Los_Angeles' },
  { label: 'Arizona (AZ)', value: 'America/Phoenix' },
  { label: 'Alaska (AK)', value: 'America/Anchorage' },
  { label: 'Hawaii (HI)', value: 'Pacific/Honolulu' },
];
