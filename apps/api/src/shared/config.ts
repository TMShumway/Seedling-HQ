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
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  COGNITO_REGION: string;
  S3_BUCKET: string;
  S3_REGION: string;
  S3_ENDPOINT: string;
  SMS_PROVIDER: 'stub' | 'aws';
  SMS_REGION: string;
  SMS_ORIGINATION_IDENTITY: string;
  SQS_REGION: string;
  SQS_ENDPOINT: string;
  SQS_MESSAGE_QUEUE_URL: string;
  WORKER_MODE: 'off' | 'inline';
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

const VALID_AUTH_MODES = ['local', 'cognito'] as const;

export function loadConfig(): AppConfig {
  const nodeEnv = optional('NODE_ENV', 'development');

  const authMode = optional('AUTH_MODE', 'local');
  if (!VALID_AUTH_MODES.includes(authMode as any)) {
    throw new Error(`Invalid AUTH_MODE '${authMode}'. Must be one of: ${VALID_AUTH_MODES.join(', ')}`);
  }

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

  // S3 vars: bucket always required (set by .env.localstack in dev, env vars in prod)
  const s3Bucket = required('S3_BUCKET');
  const s3Region = optional('S3_REGION', 'us-east-1');
  const s3Endpoint = optional('S3_ENDPOINT', '');

  // Cognito vars: required when AUTH_MODE=cognito, optional otherwise
  const cognitoUserPoolId = authMode === 'cognito' ? required('COGNITO_USER_POOL_ID') : optional('COGNITO_USER_POOL_ID', '');
  const cognitoClientId = authMode === 'cognito' ? required('COGNITO_CLIENT_ID') : optional('COGNITO_CLIENT_ID', '');
  const cognitoRegion = authMode === 'cognito' ? required('COGNITO_REGION') : optional('COGNITO_REGION', '');

  // SMS / SQS / Worker
  const smsProvider = optional('SMS_PROVIDER', 'stub');
  if (smsProvider !== 'stub' && smsProvider !== 'aws') {
    throw new Error(`Invalid SMS_PROVIDER '${smsProvider}'. Must be one of: stub, aws`);
  }
  const workerMode = optional('WORKER_MODE', 'off');
  if (workerMode !== 'off' && workerMode !== 'inline') {
    throw new Error(`Invalid WORKER_MODE '${workerMode}'. Must be one of: off, inline`);
  }

  return {
    DATABASE_URL: required('DATABASE_URL'),
    API_PORT: parseInt(optional('API_PORT', '4000'), 10),
    NODE_ENV: nodeEnv,
    AUTH_MODE: authMode as 'local' | 'cognito',
    DEV_AUTH_TENANT_ID: optional('DEV_AUTH_TENANT_ID', ''),
    DEV_AUTH_USER_ID: optional('DEV_AUTH_USER_ID', ''),
    DEV_AUTH_ROLE: optional('DEV_AUTH_ROLE', ''),
    NOTIFICATION_ENABLED: optional('NOTIFICATION_ENABLED', 'true') === 'true',
    SMTP_HOST: optional('SMTP_HOST', 'localhost'),
    SMTP_PORT: parseInt(optional('SMTP_PORT', '1025'), 10),
    SMTP_FROM: optional('SMTP_FROM', 'noreply@seedling.local'),
    APP_BASE_URL: optional('APP_BASE_URL', 'http://localhost:5173'),
    SECURE_LINK_HMAC_SECRET: hmacSecret,
    COGNITO_USER_POOL_ID: cognitoUserPoolId,
    COGNITO_CLIENT_ID: cognitoClientId,
    COGNITO_REGION: cognitoRegion,
    S3_BUCKET: s3Bucket,
    S3_REGION: s3Region,
    S3_ENDPOINT: s3Endpoint,
    SMS_PROVIDER: smsProvider as 'stub' | 'aws',
    SMS_REGION: optional('SMS_REGION', 'us-east-1'),
    SMS_ORIGINATION_IDENTITY: optional('SMS_ORIGINATION_IDENTITY', ''),
    SQS_REGION: optional('SQS_REGION', 'us-east-1'),
    SQS_ENDPOINT: nodeEnv === 'production'
      ? optional('SQS_ENDPOINT', '')
      : optional('SQS_ENDPOINT', 'http://localhost:4566'),
    SQS_MESSAGE_QUEUE_URL: optional('SQS_MESSAGE_QUEUE_URL', ''),
    WORKER_MODE: workerMode as 'off' | 'inline',
  };
}
