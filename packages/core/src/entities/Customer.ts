import { DomainError } from '../errors/DomainError.js';

export class Customer {
  private constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly name: string,
    public readonly phoneNumber: string | null,
    public readonly createdAt: Date,
    private _isActive: boolean = true
  ) {
    this.validateEmail(email);
    this.validateName(name);
    if (phoneNumber) {
      this.validatePhoneNumber(phoneNumber);
    }
  }

  // Factory method for creating new customers
  static create(
    id: string,
    email: string,
    name: string,
    phoneNumber?: string
  ): Customer {
    return new Customer(
      id,
      email,
      name,
      phoneNumber || null,
      new Date(),
      true
    );
  }

  // Factory method for reconstructing from persistence
  static fromPersistence(data: {
    id: string;
    email: string;
    name: string;
    phoneNumber: string | null;
    createdAt: Date;
    isActive: boolean;
  }): Customer {
    return new Customer(
      data.id,
      data.email,
      data.name,
      data.phoneNumber,
      data.createdAt,
      data.isActive
    );
  }

  // Business logic methods
  activate(): void {
    if (this._isActive) {
      throw new DomainError('Customer is already active');
    }
    this._isActive = true;
  }

  deactivate(): void {
    if (!this._isActive) {
      throw new DomainError('Customer is already inactive');
    }
    this._isActive = false;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  // Business rules
  canPlaceOrder(): boolean {
    return this._isActive;
  }

  canReceiveMarketing(): boolean {
    return this._isActive && this.email.length > 0;
  }

  // Validation methods (business rules)
  private validateEmail(email: string): void {
    if (!email || email.trim().length === 0) {
      throw new DomainError('Email is required');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new DomainError('Invalid email format');
    }
  }

  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new DomainError('Name is required');
    }
    
    if (name.trim().length < 2) {
      throw new DomainError('Name must be at least 2 characters long');
    }
    
    if (name.trim().length > 100) {
      throw new DomainError('Name cannot exceed 100 characters');
    }
  }

  private validatePhoneNumber(phoneNumber: string): void {
    // Simple phone validation - can be enhanced based on business needs
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
    if (!phoneRegex.test(phoneNumber)) {
      throw new DomainError('Invalid phone number format');
    }
  }

  // Value object for serialization (useful for API responses)
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      phoneNumber: this.phoneNumber,
      isActive: this._isActive,
      createdAt: this.createdAt.toISOString()
    };
  }
}
