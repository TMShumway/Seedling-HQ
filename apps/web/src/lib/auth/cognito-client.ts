import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoRefreshToken,
} from 'amazon-cognito-identity-js';
import type { ICognitoStorage } from 'amazon-cognito-identity-js';

export type SignInResult =
  | { type: 'success'; session: CognitoUserSession }
  | { type: 'newPasswordRequired'; cognitoUser: CognitoUser; requiredAttributes: unknown };

export class CognitoAuthClient {
  private pool: CognitoUserPool;
  private storage: ICognitoStorage;

  constructor(userPoolId: string, clientId: string, storage: ICognitoStorage) {
    this.storage = storage;
    this.pool = new CognitoUserPool({
      UserPoolId: userPoolId,
      ClientId: clientId,
      Storage: storage,
    });
  }

  signIn(username: string, password: string): Promise<SignInResult> {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: username,
        Pool: this.pool,
        Storage: this.storage,
      });

      user.setAuthenticationFlowType('USER_PASSWORD_AUTH');

      const authDetails = new AuthenticationDetails({
        Username: username,
        Password: password,
      });

      user.authenticateUser(authDetails, {
        onSuccess: (session) => {
          resolve({ type: 'success', session });
        },
        onFailure: (err) => {
          reject(err);
        },
        newPasswordRequired: (_userAttributes, requiredAttributes) => {
          resolve({ type: 'newPasswordRequired', cognitoUser: user, requiredAttributes });
        },
      });
    });
  }

  completeNewPassword(
    cognitoUser: CognitoUser,
    newPassword: string,
    requiredAttributes: unknown,
  ): Promise<CognitoUserSession> {
    return new Promise((resolve, reject) => {
      cognitoUser.completeNewPasswordChallenge(
        newPassword,
        requiredAttributes as Record<string, string>,
        {
          onSuccess: (session) => resolve(session),
          onFailure: (err) => reject(err),
        },
      );
    });
  }

  refreshSession(): Promise<CognitoUserSession | null> {
    const user = this.getCurrentUser();
    if (!user) return Promise.resolve(null);

    return new Promise((resolve, reject) => {
      user.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          resolve(null);
          return;
        }

        const refreshToken = session.getRefreshToken();
        if (!refreshToken) {
          resolve(null);
          return;
        }

        user.refreshSession(
          new CognitoRefreshToken({ RefreshToken: refreshToken.getToken() }),
          (refreshErr: Error | null, newSession: CognitoUserSession | null) => {
            if (refreshErr) {
              reject(refreshErr);
              return;
            }
            resolve(newSession);
          },
        );
      });
    });
  }

  getSession(): Promise<CognitoUserSession | null> {
    const user = this.getCurrentUser();
    if (!user) return Promise.resolve(null);

    return new Promise((resolve) => {
      user.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          resolve(null);
          return;
        }
        resolve(session);
      });
    });
  }

  signOut(): void {
    const user = this.getCurrentUser();
    if (user) {
      user.signOut();
    }
    this.storage.clear();
  }

  forgotPassword(username: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: username,
        Pool: this.pool,
        Storage: this.storage,
      });

      user.forgotPassword({
        onSuccess: () => resolve(),
        onFailure: (err) => reject(err),
        inputVerificationCode: () => resolve(),
      });
    });
  }

  confirmForgotPassword(username: string, code: string, newPassword: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const user = new CognitoUser({
        Username: username,
        Pool: this.pool,
        Storage: this.storage,
      });

      user.confirmPassword(code, newPassword, {
        onSuccess: () => resolve(),
        onFailure: (err) => reject(err),
      });
    });
  }

  changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const user = this.getCurrentUser();
      if (!user) {
        reject(new Error('No authenticated user'));
        return;
      }

      user.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          reject(err || new Error('No session'));
          return;
        }

        user.changePassword(oldPassword, newPassword, (changeErr) => {
          if (changeErr) {
            reject(changeErr);
            return;
          }
          resolve();
        });
      });
    });
  }

  getCurrentUser(): CognitoUser | null {
    return this.pool.getCurrentUser();
  }
}
