import { buildApp } from './app';

const start = async (): Promise<void> => {
  try {
    const app = await buildApp({
      logger: true,
      stage: process.env.STAGE || 'dev'
    });

    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    
    console.log(`
🚀 Seedling HQ API Server is running!
📍 Local development: http://localhost:${port}
📡 Network access: http://${host}:${port}
🔍 Health check: http://localhost:${port}/health
📖 API docs: http://localhost:${port}/api/v1
🌍 Environment: ${process.env.NODE_ENV || 'development'}
🏷️  Stage: ${process.env.STAGE || 'dev'}
    `);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  process.exit(0);
});

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
