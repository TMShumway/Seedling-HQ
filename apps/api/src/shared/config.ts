export interface AppConfig {
  DATABASE_URL: string;
  API_PORT: number;
  NODE_ENV: string;
  AUTH_MODE: 'local' | 'cognito';
  DEV_AUTH_TENANT_ID: string;
  DEV_AUTH_USER_ID: string;
  DEV_AUTH_ROLE: string;
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export function loadConfig(): AppConfig {
  return {
    DATABASE_URL: required('DATABASE_URL'),
    API_PORT: parseInt(optional('API_PORT', '4000'), 10),
    NODE_ENV: optional('NODE_ENV', 'development'),
    AUTH_MODE: optional('AUTH_MODE', 'local') as 'local' | 'cognito',
    DEV_AUTH_TENANT_ID: optional('DEV_AUTH_TENANT_ID', ''),
    DEV_AUTH_USER_ID: optional('DEV_AUTH_USER_ID', ''),
    DEV_AUTH_ROLE: optional('DEV_AUTH_ROLE', ''),
  };
}
