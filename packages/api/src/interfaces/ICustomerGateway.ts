import {
  CreateCustomerRequest,
  CreateCustomerResponse,
  GetCustomerResponse,
  ListCustomersResponse,
  ListCustomersParams,
} from '@seedling-hq/types';

/**
 * Customer Gateway Interface
 * Defines the contract for customer data operations
 * Implementations can be HTTP, GraphQL, local storage, etc.
 */
export interface ICustomerGateway {
  /**
   * Create a new customer
   */
  createCustomer(request: CreateCustomerRequest): Promise<CreateCustomerResponse>;

  /**
   * Get a customer by ID
   */
  getCustomer(id: string): Promise<GetCustomerResponse>;

  /**
   * List customers with optional filtering and pagination
   */
  listCustomers(params?: ListCustomersParams): Promise<ListCustomersResponse>;

  /**
   * Update a customer (for future implementation)
   */
  // updateCustomer(id: string, updates: Partial<Customer>): Promise<UpdateCustomerResponse>;

  /**
   * Delete a customer (for future implementation)
   */
  // deleteCustomer(id: string): Promise<void>;
}
