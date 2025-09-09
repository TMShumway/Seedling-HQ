import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DomainError } from '@seedling-hq/core';
import { getContainer } from '../container/Container.js';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  handleDomainError,
  handleCorsPreflightRequest,
  parseJsonBody,
  validateRequiredFields,
  HTTP_STATUS
} from './utils.js';

/**
 * Request body interface for creating a customer
 */
interface CreateCustomerRequest {
  email: string;
  name: string;
  phoneNumber?: string;
}

/**
 * POST /customers
 * Creates a new customer
 */
export const createCustomer: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  const container = getContainer();
  const logger = container.logger;

  // Add correlation ID for request tracing
  const correlationId = event.requestContext.requestId;
  logger.addContext({ correlationId });

  try {
    logger.info('Creating customer', { 
      httpMethod: event.httpMethod,
      path: event.path 
    });

    // Parse and validate request body
    const requestBody = parseJsonBody<CreateCustomerRequest>(event.body);
    
    validateRequiredFields(requestBody, ['email', 'name']);

    logger.info('Request body validated', { 
      email: requestBody.email,
      hasPhoneNumber: !!requestBody.phoneNumber 
    });

    // Execute use case
    const result = await container.addCustomerUseCase.execute({
      email: requestBody.email.trim(),
      name: requestBody.name.trim(),
      phoneNumber: requestBody.phoneNumber?.trim(),
    });

    logger.info('Customer created successfully', { 
      customerId: result.customer.id 
    });

    return createSuccessResponse(result, HTTP_STATUS.CREATED);

  } catch (error) {
    logger.error('Error creating customer', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Handle domain errors (business rule violations)
    if (error instanceof DomainError) {
      return handleDomainError(error);
    }

    // Handle validation errors
    if (error instanceof Error) {
      if (error.message.includes('Missing required fields') || 
          error.message.includes('Invalid JSON')) {
        return createErrorResponse(error.message, HTTP_STATUS.BAD_REQUEST);
      }
    }

    // Handle unexpected errors
    return createErrorResponse(
      'Internal server error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * GET /customers/{id}
 * Retrieves a customer by ID
 */
export const getCustomer: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  const container = getContainer();
  const logger = container.logger;

  const correlationId = event.requestContext.requestId;
  logger.addContext({ correlationId });

  try {
    const customerId = event.pathParameters?.id;

    if (!customerId) {
      return createErrorResponse('Customer ID is required', HTTP_STATUS.BAD_REQUEST);
    }

    logger.info('Retrieving customer', { customerId });

    // Use the repository directly for simple read operations
    const customer = await container.customerRepository.findById(customerId);

    if (!customer) {
      return createErrorResponse('Customer not found', HTTP_STATUS.NOT_FOUND);
    }

    logger.info('Customer retrieved successfully', { customerId });

    // Convert to JSON representation
    return createSuccessResponse({
      customer: customer.toJSON()
    });

  } catch (error) {
    logger.error('Error retrieving customer', {
      error: error instanceof Error ? error.message : 'Unknown error',
      customerId: event.pathParameters?.id
    });

    return createErrorResponse(
      'Internal server error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * GET /customers
 * Lists customers with pagination
 */
export const listCustomers: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  const container = getContainer();
  const logger = container.logger;

  const correlationId = event.requestContext.requestId;
  logger.addContext({ correlationId });

  try {
    // Parse query parameters
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || '10'), 100);
    const offset = Math.max(parseInt(event.queryStringParameters?.offset || '0'), 0);
    const isActiveParam = event.queryStringParameters?.isActive;
    
    let isActive: boolean | undefined = undefined;
    if (isActiveParam === 'true') isActive = true;
    if (isActiveParam === 'false') isActive = false;

    logger.info('Listing customers', { limit, offset, isActive });

    // Get customers and total count
    const [customers, totalCount] = await Promise.all([
      container.customerRepository.findMany({ limit, offset, isActive }),
      container.customerRepository.count({ isActive })
    ]);

    logger.info('Customers retrieved successfully', { 
      count: customers.length,
      totalCount 
    });

    return createSuccessResponse({
      customers: customers.map(customer => customer.toJSON()),
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount
      }
    });

  } catch (error) {
    logger.error('Error listing customers', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return createErrorResponse(
      'Internal server error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};
