export type AuthMode = 'local' | 'cognito';

export function getAuthMode(): AuthMode {
  const mode = import.meta.env.VITE_AUTH_MODE || 'local';
  if (mode !== 'local' && mode !== 'cognito') {
    throw new Error(`Invalid VITE_AUTH_MODE: "${mode}". Must be "local" or "cognito".`);
  }
  return mode;
}

export function isLocalMode(): boolean {
  return getAuthMode() === 'local';
}

export function isCognitoMode(): boolean {
  return getAuthMode() === 'cognito';
}

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
}

export function getCognitoConfig(): CognitoConfig {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

  if (!userPoolId || !clientId) {
    throw new Error(
      'VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID must be set when VITE_AUTH_MODE=cognito',
    );
  }

  return { userPoolId, clientId };
}
