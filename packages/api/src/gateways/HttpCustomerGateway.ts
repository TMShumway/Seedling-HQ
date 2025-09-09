import {
  CreateCustomerRequest,
  CreateCustomerResponse,
  GetCustomerResponse,
  ListCustomersResponse,
  ListCustomersParams,
  ApiErrorResponse,
} from '@seedling-hq/types';
import { ICustomerGateway } from '../interfaces/ICustomerGateway.js';

/**
 * Configuration for HTTP Customer Gateway
 */
export interface HttpCustomerGatewayConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * HTTP implementation of the Customer Gateway
 * Handles REST API communication with the backend
 */
export class HttpCustomerGateway implements ICustomerGateway {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly headers: Record<string, string>;

  constructor(config: HttpCustomerGatewayConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout || 30000; // 30 seconds default
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  async createCustomer(request: CreateCustomerRequest): Promise<CreateCustomerResponse> {
    const response = await this.fetchWithTimeout('/customers', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response.json() as Promise<CreateCustomerResponse>;
  }

  async getCustomer(id: string): Promise<GetCustomerResponse> {
    const response = await this.fetchWithTimeout(`/customers/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response.json() as Promise<GetCustomerResponse>;
  }

  async listCustomers(params?: ListCustomersParams): Promise<ListCustomersResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.limit !== undefined) {
      searchParams.append('limit', params.limit.toString());
    }
    if (params?.offset !== undefined) {
      searchParams.append('offset', params.offset.toString());
    }
    if (params?.isActive !== undefined) {
      searchParams.append('isActive', params.isActive.toString());
    }

    const queryString = searchParams.toString();
    const url = `/customers${queryString ? `?${queryString}` : ''}`;

    const response = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response.json() as Promise<ListCustomersResponse>;
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(
    endpoint: string,
    options: RequestInit
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Handle error responses from the API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorBody = await response.json() as ApiErrorResponse;
      if (errorBody.error?.message) {
        errorMessage = errorBody.error.message;
      }
    } catch {
      // If we can't parse the error response, use the default message
    }

    const error = new Error(errorMessage);
    (error as any).status = response.status;
    throw error;
  }
}
