export interface AppConfig {
  DATABASE_URL: string;
  API_PORT: number;
  NODE_ENV: string;
  AUTH_MODE: 'local' | 'cognito';
  DEV_AUTH_TENANT_ID: string;
  DEV_AUTH_USER_ID: string;
  DEV_AUTH_ROLE: string;
  NOTIFICATION_ENABLED: boolean;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_FROM: string;
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
    NOTIFICATION_ENABLED: optional('NOTIFICATION_ENABLED', 'true') === 'true',
    SMTP_HOST: optional('SMTP_HOST', 'localhost'),
    SMTP_PORT: parseInt(optional('SMTP_PORT', '1025'), 10),
    SMTP_FROM: optional('SMTP_FROM', 'noreply@seedling.local'),
  };
}
