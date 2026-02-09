import { describe, it, expect } from 'vitest';
import { getEventLabel } from '../../src/application/dto/timeline-dto.js';

describe('getEventLabel', () => {
  it('returns known label for client.created', () => {
    expect(getEventLabel('client.created')).toBe('Client created');
  });

  it('returns known label for client.updated', () => {
    expect(getEventLabel('client.updated')).toBe('Client updated');
  });

  it('returns known label for client.deactivated', () => {
    expect(getEventLabel('client.deactivated')).toBe('Client removed');
  });

  it('returns known label for property.created', () => {
    expect(getEventLabel('property.created')).toBe('Property added');
  });

  it('returns known label for property.updated', () => {
    expect(getEventLabel('property.updated')).toBe('Property updated');
  });

  it('returns known label for property.deactivated', () => {
    expect(getEventLabel('property.deactivated')).toBe('Property removed');
  });

  it('returns titlecased fallback for unknown event', () => {
    expect(getEventLabel('quote.sent')).toBe('Quote sent');
  });

  it('returns titlecased fallback for multi-word event', () => {
    expect(getEventLabel('invoice.paid')).toBe('Invoice paid');
  });
});
