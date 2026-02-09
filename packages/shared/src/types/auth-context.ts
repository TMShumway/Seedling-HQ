export interface InternalAuthContext {
  principal_type: 'internal';
  tenant_id: string;
  user_id: string;
  role: string;
}

export interface ExternalAuthContext {
  principal_type: 'external';
  tenant_id: string;
  token_id: string;
  scope: string;
  object_type: string;
  object_id: string;
}

export type AuthContext = InternalAuthContext | ExternalAuthContext;
