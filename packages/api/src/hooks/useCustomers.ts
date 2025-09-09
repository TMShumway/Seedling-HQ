import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Customer, 
  CreateCustomerRequest, 
  ListCustomersParams,
  ListCustomersResponse,
  GetCustomerResponse
} from '@seedling-hq/types';
import { getApiFactory } from '../factories/ApiFactory.js';

/**
 * Query Keys for customer operations
 * Centralized to ensure consistency and enable cache invalidation
 */
export const customerQueryKeys = {
  all: ['customers'] as const,
  lists: () => [...customerQueryKeys.all, 'list'] as const,
  list: (params?: ListCustomersParams) => [...customerQueryKeys.lists(), params] as const,
  details: () => [...customerQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerQueryKeys.details(), id] as const,
};

/**
 * Hook to fetch a list of customers
 */
export function useCustomers(params?: ListCustomersParams) {
  const apiFactory = getApiFactory();
  const customerGateway = apiFactory.getCustomerGateway();

  return useQuery({
    queryKey: customerQueryKeys.list(params),
    queryFn: () => customerGateway.listCustomers(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

/**
 * Hook to fetch a single customer by ID
 */
export function useCustomer(id: string) {
  const apiFactory = getApiFactory();
  const customerGateway = apiFactory.getCustomerGateway();

  return useQuery({
    queryKey: customerQueryKeys.detail(id),
    queryFn: () => customerGateway.getCustomer(id),
    enabled: !!id, // Only run if ID is provided
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to create a new customer
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const apiFactory = getApiFactory();
  const customerGateway = apiFactory.getCustomerGateway();

  return useMutation({
    mutationFn: (request: CreateCustomerRequest) => 
      customerGateway.createCustomer(request),
    
    onSuccess: (data) => {
      // Add the new customer to existing lists in cache
      queryClient.setQueryData<ListCustomersResponse>(
        customerQueryKeys.list(), 
        (oldData: ListCustomersResponse | undefined): ListCustomersResponse | undefined => {
          if (!oldData) return oldData;
          
          return {
            ...oldData,
            data: {
              ...oldData.data,
              customers: [data.data.customer, ...oldData.data.customers],
              pagination: {
                ...oldData.data.pagination,
                total: oldData.data.pagination.total + 1,
              },
            },
          };
        }
      );

      // Cache the individual customer
      queryClient.setQueryData(
        customerQueryKeys.detail(data.data.customer.id),
        data
      );

      // Invalidate and refetch customer lists to ensure consistency
      queryClient.invalidateQueries({ 
        queryKey: customerQueryKeys.lists() 
      });
    },

    onError: (error) => {
      console.error('Failed to create customer:', error);
    },
  });
}

/**
 * Hook to prefetch customers list
 * Useful for preloading data before navigation
 */
export function usePrefetchCustomers() {
  const queryClient = useQueryClient();
  const apiFactory = getApiFactory();
  const customerGateway = apiFactory.getCustomerGateway();

  return (params?: ListCustomersParams) => {
    queryClient.prefetchQuery({
      queryKey: customerQueryKeys.list(params),
      queryFn: () => customerGateway.listCustomers(params),
      staleTime: 5 * 60 * 1000,
    });
  };
}

/**
 * Hook to get optimistic updates for customer operations
 */
export function useCustomerCache() {
  const queryClient = useQueryClient();

  return {
    /**
     * Get cached customer data
     */
    getCustomer: (id: string): Customer | undefined => {
      const cached = queryClient.getQueryData<GetCustomerResponse>(customerQueryKeys.detail(id));
      return cached?.data?.customer;
    },

    /**
     * Get cached customers list
     */
    getCustomersList: (params?: ListCustomersParams): Customer[] | undefined => {
      const cached = queryClient.getQueryData<ListCustomersResponse>(customerQueryKeys.list(params));
      return cached?.data?.customers;
    },

    /**
     * Manually invalidate customer cache
     */
    invalidateCustomers: () => {
      queryClient.invalidateQueries({ 
        queryKey: customerQueryKeys.all 
      });
    },

    /**
     * Remove customer from cache
     */
    removeCustomer: (id: string) => {
      queryClient.removeQueries({ 
        queryKey: customerQueryKeys.detail(id) 
      });
    },
  };
}
