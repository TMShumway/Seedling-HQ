import { AddCustomerUseCase } from '@seedling-hq/use-cases';
import { CustomerRepository, IdGenerator } from '@seedling-hq/ports';
import { 
  DrizzleCustomerRepository, 
  createDatabaseConnectionFromEnv 
} from '@seedling-hq/database-drizzle';
import { NanoIdGenerator } from '../adapters/NanoIdGenerator.js';
import { Logger } from '@aws-lambda-powertools/logger';

/**
 * Dependency Injection Container
 * 
 * This is where we wire up all our dependencies following Clean Architecture principles.
 * The container knows about concrete implementations but the use cases only know about interfaces.
 * 
 * This makes it easy to:
 * - Swap implementations (e.g., Drizzle → Prisma)
 * - Test with mocks
 * - Configure different environments
 */
export class Container {
  // Infrastructure layer
  private readonly _logger: Logger;
  private readonly _database: ReturnType<typeof createDatabaseConnectionFromEnv>;
  
  // Adapters (implementations of ports)
  private readonly _customerRepository: CustomerRepository;
  private readonly _idGenerator: IdGenerator;
  
  // Use cases (application layer)
  private readonly _addCustomerUseCase: AddCustomerUseCase;

  constructor() {
    // Initialize logger
    this._logger = new Logger({
      serviceName: 'seedling-hq-api',
      logLevel: (process.env.LOG_LEVEL as any) || 'INFO'
    });

    try {
      // Initialize database connection
      this._database = createDatabaseConnectionFromEnv();
      this._logger.info('Database connection initialized');

      // Initialize adapters
      this._customerRepository = new DrizzleCustomerRepository(this._database);
      this._idGenerator = new NanoIdGenerator();
      
      this._logger.info('Repository and ID generator initialized');

      // Initialize use cases
      this._addCustomerUseCase = new AddCustomerUseCase(
        this._customerRepository,
        this._idGenerator
      );

      this._logger.info('Use cases initialized');
      
    } catch (error) {
      this._logger.error('Failed to initialize container', { error });
      throw new Error('Container initialization failed');
    }
  }

  // Public getters for accessing configured instances

  get logger(): Logger {
    return this._logger;
  }

  get customerRepository(): CustomerRepository {
    return this._customerRepository;
  }

  get idGenerator(): IdGenerator {
    return this._idGenerator;
  }

  get addCustomerUseCase(): AddCustomerUseCase {
    return this._addCustomerUseCase;
  }

  /**
   * Clean up resources when shutting down
   */
  async dispose(): Promise<void> {
    try {
      // Close database connections if needed
      // Note: Drizzle with postgres.js handles connection cleanup automatically
      this._logger.info('Container disposed successfully');
    } catch (error) {
      this._logger.error('Error disposing container', { error });
    }
  }
}

// Singleton instance
let containerInstance: Container | null = null;

/**
 * Get the container singleton instance
 * Creates a new instance if one doesn't exist
 */
export function getContainer(): Container {
  if (!containerInstance) {
    containerInstance = new Container();
  }
  return containerInstance;
}

/**
 * Reset the container (useful for testing)
 */
export function resetContainer(): void {
  containerInstance = null;
}
