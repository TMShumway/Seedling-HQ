import { Customer, DomainError } from '@seedling-hq/core';
import { CustomerRepository, IdGenerator } from '@seedling-hq/ports';

/**
 * Input data for the AddCustomer use case
 */
export interface AddCustomerInput {
  email: string;
  name: string;
  phoneNumber?: string;
}

/**
 * Output data from the AddCustomer use case
 */
export interface AddCustomerOutput {
  customer: {
    id: string;
    email: string;
    name: string;
    phoneNumber: string | null;
    isActive: boolean;
    createdAt: string;
  };
}

/**
 * Use case for adding a new customer to the system.
 * Orchestrates the business logic for customer creation including validation and persistence.
 */
export class AddCustomerUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly idGenerator: IdGenerator
  ) {}

  /**
   * Execute the use case to add a new customer
   */
  async execute(input: AddCustomerInput): Promise<AddCustomerOutput> {
    // Business rule: Check if customer with email already exists
    const existingCustomer = await this.customerRepository.existsByEmail(input.email);
    
    if (existingCustomer) {
      throw DomainError.businessRule(
        'A customer with this email address already exists',
        'UNIQUE_EMAIL_REQUIRED'
      );
    }

    // Generate unique ID for the new customer
    const customerId = this.idGenerator.generateWithPrefix('cust');

    // Create the customer entity (this will validate the input)
    const customer = Customer.create(
      customerId,
      input.email.trim(),
      input.name.trim(),
      input.phoneNumber?.trim()
    );

    // Persist the customer
    await this.customerRepository.save(customer);

    // Return the result
    return {
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phoneNumber: customer.phoneNumber,
        isActive: customer.isActive,
        createdAt: customer.createdAt.toISOString()
      }
    };
  }
}
