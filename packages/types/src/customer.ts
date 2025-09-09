/**
 * Customer API contract types
 * These types define the API boundary - what goes over the wire
 * Shared between frontend and backend to ensure type safety
 */

export interface Customer {
  id: string;
  email: string;
  name: string;
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateCustomerRequest {
  email: string;
  name: string;
  phoneNumber?: string;
}

export interface CreateCustomerResponse {
  success: boolean;
  data: {
    customer: Customer;
  };
}

export interface GetCustomerResponse {
  success: boolean;
  data: {
    customer: Customer;
  };
}

export interface ListCustomersResponse {
  success: boolean;
  data: {
    customers: Customer[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
      hasMore: boolean;
    };
  };
}

export interface ListCustomersParams {
  limit?: number;
  offset?: number;
  isActive?: boolean;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code: number;
    details?: any;
  };
}
