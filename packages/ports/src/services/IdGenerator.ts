/**
 * Service interface for generating unique identifiers.
 * This allows the business logic to be independent of ID generation strategy.
 */
export interface IdGenerator {
  /**
   * Generate a new unique identifier
   */
  generate(): string;

  /**
   * Generate a unique identifier with a specific prefix
   */
  generateWithPrefix(prefix: string): string;

  /**
   * Validate if an ID has the correct format
   */
  isValid(id: string): boolean;
}
