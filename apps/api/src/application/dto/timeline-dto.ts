export interface TimelineEvent {
  id: string;
  eventName: string;
  label: string;
  subjectType: string;
  subjectId: string;
  principalId: string;
  createdAt: string;
}

const EVENT_LABELS: Record<string, string> = {
  'client.created': 'Client created',
  'client.updated': 'Client updated',
  'client.deactivated': 'Client removed',
  'property.created': 'Property added',
  'property.updated': 'Property updated',
  'property.deactivated': 'Property removed',
};

export function getEventLabel(eventName: string): string {
  if (EVENT_LABELS[eventName]) {
    return EVENT_LABELS[eventName];
  }
  // Fallback: titlecase the event name (e.g. "quote.sent" → "Quote sent")
  return eventName
    .replace('.', ' ')
    .replace(/^(\w)/, (c) => c.toUpperCase());
}
