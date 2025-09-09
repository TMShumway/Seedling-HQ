// API package - Gateway pattern implementation with TanStack Query
export const API_VERSION = '1.0.0';

// Interfaces
export type { ICustomerGateway } from './interfaces/ICustomerGateway.js';

// Gateways
export { HttpCustomerGateway, type HttpCustomerGatewayConfig } from './gateways/HttpCustomerGateway.js';

// Factory
export { 
  ApiFactory,
  configureApiFactory,
  getApiFactory,
  resetApiFactory,
  type ApiFactoryConfig 
} from './factories/ApiFactory.js';

// Hooks
export {
  useCustomers,
  useCustomer,
  useCreateCustomer,
  usePrefetchCustomers,
  useCustomerCache,
  customerQueryKeys
} from './hooks/useCustomers.js';
