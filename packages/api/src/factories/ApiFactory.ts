import { ICustomerGateway } from '../interfaces/ICustomerGateway.js';
import { HttpCustomerGateway, HttpCustomerGatewayConfig } from '../gateways/HttpCustomerGateway.js';

/**
 * Configuration for API Factory
 */
export interface ApiFactoryConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Factory for creating and configuring API gateways
 * Provides a centralized way to instantiate gateways with consistent configuration
 */
export class ApiFactory {
  private readonly config: ApiFactoryConfig;
  
  // Singleton instances (created lazily)
  private _customerGateway?: ICustomerGateway;

  constructor(config: ApiFactoryConfig) {
    this.config = {
      timeout: 30000, // 30 seconds default
      headers: {},
      ...config,
    };
  }

  /**
   * Get Customer Gateway instance
   * Creates a singleton instance on first call
   */
  getCustomerGateway(): ICustomerGateway {
    if (!this._customerGateway) {
      this._customerGateway = new HttpCustomerGateway({
        baseUrl: this.config.baseUrl,
        timeout: this.config.timeout,
        headers: this.config.headers,
      });
    }
    return this._customerGateway;
  }

  /**
   * Create a new Customer Gateway instance (not singleton)
   * Useful for testing or when you need multiple instances
   */
  createCustomerGateway(config?: Partial<HttpCustomerGatewayConfig>): ICustomerGateway {
    return new HttpCustomerGateway({
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: this.config.headers,
      ...config,
    });
  }

  /**
   * Update the factory configuration
   * This will reset singleton instances on next access
   */
  updateConfig(newConfig: Partial<ApiFactoryConfig>): void {
    Object.assign(this.config, newConfig);
    
    // Clear singleton instances so they get recreated with new config
    this._customerGateway = undefined;
  }

  /**
   * Get current configuration (read-only copy)
   */
  getConfig(): Readonly<ApiFactoryConfig> {
    return { ...this.config };
  }
}

/**
 * Default API Factory instance
 * Can be configured once and used throughout the application
 */
let defaultApiFactory: ApiFactory | null = null;

/**
 * Configure the default API factory
 * Should be called once during application startup
 */
export function configureApiFactory(config: ApiFactoryConfig): ApiFactory {
  defaultApiFactory = new ApiFactory(config);
  return defaultApiFactory;
}

/**
 * Get the default API factory instance
 * Throws an error if not configured
 */
export function getApiFactory(): ApiFactory {
  if (!defaultApiFactory) {
    throw new Error('API Factory not configured. Call configureApiFactory() first.');
  }
  return defaultApiFactory;
}

/**
 * Reset the default API factory (useful for testing)
 */
export function resetApiFactory(): void {
  defaultApiFactory = null;
}
