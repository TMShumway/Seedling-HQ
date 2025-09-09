import { Customer } from '@seedling-hq/core';

/**
 * Repository interface for Customer aggregate.
 * This defines the contract for data persistence without implementation details.
 */
export interface CustomerRepository {
  /**
   * Find a customer by their unique identifier
   */
  findById(id: string): Promise<Customer | null>;

  /**
   * Find a customer by their email address
   */
  findByEmail(email: string): Promise<Customer | null>;

  /**
   * Check if a customer exists with the given email
   */
  existsByEmail(email: string): Promise<boolean>;

  /**
   * Save a customer (create or update)
   */
  save(customer: Customer): Promise<void>;

  /**
   * Delete a customer by their ID
   */
  delete(id: string): Promise<void>;

  /**
   * Find customers with pagination
   */
  findMany(options: {
    limit: number;
    offset: number;
    isActive?: boolean;
  }): Promise<Customer[]>;

  /**
   * Count total customers (useful for pagination)
   */
  count(options?: { isActive?: boolean }): Promise<number>;
}
