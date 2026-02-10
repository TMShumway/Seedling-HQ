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
  APP_BASE_URL: string;
  SECURE_LINK_HMAC_SECRET: string;
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

const DEV_HMAC_SECRET = 'dev-secret-change-in-production';
const MIN_HMAC_SECRET_LENGTH = 16;

export function loadConfig(): AppConfig {
  const nodeEnv = optional('NODE_ENV', 'development');

  let hmacSecret: string;
  if (nodeEnv === 'production') {
    hmacSecret = process.env.SECURE_LINK_HMAC_SECRET ?? '';
    if (!hmacSecret || hmacSecret === DEV_HMAC_SECRET) {
      throw new Error('SECURE_LINK_HMAC_SECRET must be set to a non-default value in production');
    }
    if (hmacSecret.length < MIN_HMAC_SECRET_LENGTH) {
      throw new Error(`SECURE_LINK_HMAC_SECRET must be at least ${MIN_HMAC_SECRET_LENGTH} characters`);
    }
  } else {
    hmacSecret = optional('SECURE_LINK_HMAC_SECRET', DEV_HMAC_SECRET);
  }

  return {
    DATABASE_URL: required('DATABASE_URL'),
    API_PORT: parseInt(optional('API_PORT', '4000'), 10),
    NODE_ENV: nodeEnv,
    AUTH_MODE: optional('AUTH_MODE', 'local') as 'local' | 'cognito',
    DEV_AUTH_TENANT_ID: optional('DEV_AUTH_TENANT_ID', ''),
    DEV_AUTH_USER_ID: optional('DEV_AUTH_USER_ID', ''),
    DEV_AUTH_ROLE: optional('DEV_AUTH_ROLE', ''),
    NOTIFICATION_ENABLED: optional('NOTIFICATION_ENABLED', 'true') === 'true',
    SMTP_HOST: optional('SMTP_HOST', 'localhost'),
    SMTP_PORT: parseInt(optional('SMTP_PORT', '1025'), 10),
    SMTP_FROM: optional('SMTP_FROM', 'noreply@seedling.local'),
    APP_BASE_URL: optional('APP_BASE_URL', 'http://localhost:5173'),
    SECURE_LINK_HMAC_SECRET: hmacSecret,
  };
}
