import type { CognitoProvisioner } from '../../application/ports/cognito-provisioner.js';

export class NoopCognitoProvisioner implements CognitoProvisioner {
  async provisionUser(): Promise<void> {
    // No-op in local mode — users are created directly in the DB
  }

  async setUserPassword(): Promise<void> {
    // No-op in local mode — passwords are managed via password_hash column
  }
}
