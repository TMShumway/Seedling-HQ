import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminDeleteUserCommand,
  AdminListGroupsForUserCommand,
  AdminSetUserPasswordCommand,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';
import type { CognitoProvisioner } from '../../application/ports/cognito-provisioner.js';

export class AwsCognitoProvisioner implements CognitoProvisioner {
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;

  constructor(config: { COGNITO_USER_POOL_ID: string; COGNITO_REGION: string }) {
    this.userPoolId = config.COGNITO_USER_POOL_ID;
    this.client = new CognitoIdentityProviderClient({ region: config.COGNITO_REGION });
  }

  async provisionUser(params: {
    username: string;
    email: string;
    tenantId: string;
    groupName: string;
  }): Promise<void> {
    let createdInThisAttempt = false;

    // Step 1: Create user in Cognito (or skip if already exists)
    try {
      await this.client.send(
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: params.username,
          UserAttributes: [
            { Name: 'email', Value: params.email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'custom:tenant_id', Value: params.tenantId },
          ],
          DesiredDeliveryMediums: ['EMAIL'],
        }),
      );
      createdInThisAttempt = true;
    } catch (err) {
      if (err instanceof UsernameExistsException) {
        createdInThisAttempt = false;
      } else {
        throw err;
      }
    }

    // Step 2: Normalize groups — remove ALL existing groups to prevent multi-group drift.
    // The JWT verifier enforces exactly one cognito:groups entry, so any leftover
    // group (including legacy ones like "technician") would lock the user out.
    try {
      const groupsResponse = await this.client.send(
        new AdminListGroupsForUserCommand({
          UserPoolId: this.userPoolId,
          Username: params.username,
        }),
      );
      const existingGroups = (groupsResponse.Groups ?? []).map((g) => g.GroupName!);
      for (const group of existingGroups) {
        await this.client.send(
          new AdminRemoveUserFromGroupCommand({
            UserPoolId: this.userPoolId,
            Username: params.username,
            GroupName: group,
          }),
        );
      }
    } catch (err) {
      // If we created the user, clean up before rethrowing
      if (createdInThisAttempt) {
        await this.safeDeleteUser(params.username);
      }
      throw err;
    }

    // Step 3: Add user to the target group
    try {
      await this.client.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: this.userPoolId,
          Username: params.username,
          GroupName: params.groupName,
        }),
      );
    } catch (err) {
      // Only delete if we created the user in this call
      if (createdInThisAttempt) {
        await this.safeDeleteUser(params.username);
      }
      throw err;
    }
  }

  async setUserPassword(username: string, password: string, permanent: boolean): Promise<void> {
    await this.client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        Password: password,
        Permanent: permanent,
      }),
    );
  }

  private async safeDeleteUser(username: string): Promise<void> {
    try {
      await this.client.send(
        new AdminDeleteUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
        }),
      );
    } catch {
      // Best effort cleanup — don't mask the original error
    }
  }
}
