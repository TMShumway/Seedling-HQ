export interface CognitoProvisioner {
  /** Atomic create-and-assign: AdminCreateUser + AdminAddUserToGroup.
   *  If createUser succeeds but addUserToGroup fails, calls AdminDeleteUser for cleanup before throwing.
   *  If user already exists in Cognito (UsernameExistsException from retry), skips create and just assigns group. */
  provisionUser(params: {
    username: string;
    email: string;
    tenantId: string;
    groupName: string;
  }): Promise<void>;

  /** AdminSetUserPassword (for admin reset). */
  setUserPassword(username: string, password: string, permanent: boolean): Promise<void>;
}
