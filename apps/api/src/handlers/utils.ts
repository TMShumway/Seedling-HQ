import { APIGatewayProxyResult } from 'aws-lambda';
import { DomainError } from '@seedling-hq/core';

/**
 * HTTP response utilities for Lambda handlers
 */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Default CORS headers for all responses
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
} as const;

/**
 * Create a successful HTTP response
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = HTTP_STATUS.OK
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      data,
    }),
  };
}

/**
 * Create an error HTTP response
 */
export function createErrorResponse(
  message: string,
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  details?: any
): APIGatewayProxyResult {
  const errorBody: any = {
    success: false,
    error: {
      message,
      code: statusCode,
    },
  };

  if (details) {
    errorBody.error.details = details;
  }

  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(errorBody),
  };
}

/**
 * Handle domain errors and map them to appropriate HTTP status codes
 */
export function handleDomainError(error: DomainError): APIGatewayProxyResult {
  // Map domain error codes to HTTP status codes
  const statusCodeMap: Record<string, number> = {
    VALIDATION_ERROR: HTTP_STATUS.BAD_REQUEST,
    BUSINESS_RULE_VIOLATION: HTTP_STATUS.BAD_REQUEST,
    UNIQUE_EMAIL_REQUIRED: HTTP_STATUS.BAD_REQUEST,
  };

  const statusCode = error.code ? statusCodeMap[error.code] || HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.BAD_REQUEST;

  return createErrorResponse(error.message, statusCode, {
    code: error.code,
    context: error.context,
  });
}

/**
 * Parse JSON body from Lambda event
 */
export function parseJsonBody<T>(body: string | null): T {
  if (!body) {
    throw new Error('Request body is required');
  }

  try {
    return JSON.parse(body) as T;
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields<T extends Record<string, any>>(
  data: T,
  requiredFields: (keyof T)[]
): void {
  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  });

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflightRequest(): APIGatewayProxyResult {
  return {
    statusCode: HTTP_STATUS.OK,
    headers: CORS_HEADERS,
    body: '',
  };
}
