import { IdGenerator } from '@seedling-hq/ports';
import { nanoid } from 'nanoid';

/**
 * NanoID implementation of IdGenerator interface.
 * Provides URL-safe, unique identifiers with customizable prefixes.
 */
export class NanoIdGenerator implements IdGenerator {
  private readonly alphabet: string;
  private readonly defaultSize: number;

  constructor(options?: {
    alphabet?: string;
    size?: number;
  }) {
    // URL-safe alphabet (no ambiguous characters like 0/O, 1/I/l)
    this.alphabet = options?.alphabet || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    this.defaultSize = options?.size || 12;
  }

  generate(): string {
    return nanoid(this.defaultSize);
  }

  generateWithPrefix(prefix: string): string {
    if (!prefix || prefix.trim().length === 0) {
      throw new Error('Prefix cannot be empty');
    }

    const cleanPrefix = prefix.trim();
    const id = nanoid(this.defaultSize);
    
    return `${cleanPrefix}_${id}`;
  }

  isValid(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }

    // Check if it's a prefixed ID (contains underscore)
    if (id.includes('_')) {
      const parts = id.split('_');
      if (parts.length !== 2) {
        return false;
      }
      
      const [prefix, idPart] = parts;
      
      // Prefix validation: only alphanumeric characters
      if (!/^[a-zA-Z0-9]+$/.test(prefix)) {
        return false;
      }
      
      // ID part validation: check length and characters
      return this.isValidIdPart(idPart);
    }
    
    // Non-prefixed ID validation
    return this.isValidIdPart(id);
  }

  /**
   * Validates the ID part (without prefix)
   */
  private isValidIdPart(idPart: string): boolean {
    // Should be the expected length
    if (idPart.length !== this.defaultSize) {
      return false;
    }

    // Should only contain characters from our alphabet
    return idPart.split('').every(char => this.alphabet.includes(char));
  }
}
