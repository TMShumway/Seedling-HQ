/**
 * Domain error represents a violation of business rules.
 * These should be caught and handled appropriately by the application layer.
 */
export class DomainError extends Error {
  public readonly name = 'DomainError';
  
  constructor(
    message: string,
    public readonly code?: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DomainError);
    }
  }

  /**
   * Creates a domain error with additional context
   */
  static withContext(message: string, context: Record<string, any>, code?: string): DomainError {
    return new DomainError(message, code, context);
  }

  /**
   * Creates a validation domain error
   */
  static validation(message: string, field?: string): DomainError {
    return new DomainError(
      message,
      'VALIDATION_ERROR',
      field ? { field } : undefined
    );
  }

  /**
   * Creates a business rule violation error
   */
  static businessRule(message: string, rule?: string): DomainError {
    return new DomainError(
      message,
      'BUSINESS_RULE_VIOLATION',
      rule ? { rule } : undefined
    );
  }
}
