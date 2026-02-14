import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

export interface DevSandboxStackProps extends cdk.StackProps {
  env_name: string;
  owner: string;
  allowedOrigin?: string;
}

export class DevSandboxStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly appClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: DevSandboxStackProps) {
    super(scope, id, props);

    const { env_name, owner, allowedOrigin = 'http://localhost:5173' } = props;
    const prefix = `fsa-${env_name}-${owner}`;

    // Tags applied to all resources in the stack
    cdk.Tags.of(this).add('app', 'fsa');
    cdk.Tags.of(this).add('env', env_name);
    cdk.Tags.of(this).add('owner', owner);

    // -------------------------------------------------------------------
    // Cognito User Pool
    // -------------------------------------------------------------------
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${prefix}-user-pool`,

      // UUID username — NOT email. Enables same-email-across-tenants.
      signInAliases: {},

      autoVerify: { email: true },
      selfSignUpEnabled: false,

      standardAttributes: {
        email: { required: true, mutable: true },
      },
      customAttributes: {
        tenant_id: new cognito.StringAttribute({ mutable: false }),
      },

      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },

      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,

      // Essentials plan required for access token customization via pre-token-generation V2 trigger
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
    });

    // -------------------------------------------------------------------
    // Pre-token-generation V2 Lambda trigger
    // Copies custom:tenant_id into the access token so API can validate
    // access tokens (security best practice) instead of ID tokens.
    // -------------------------------------------------------------------
    const preTokenFn = new lambda.Function(this, 'PreTokenGenerationFn', {
      functionName: `${prefix}-pre-token-gen`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
exports.handler = async (event) => {
  const tenantId = event.request?.userAttributes?.['custom:tenant_id'] ?? '';
  event.response ??= {};
  event.response.claimsAndScopeOverrideDetails ??= {};
  event.response.claimsAndScopeOverrideDetails.accessTokenGeneration ??= {};
  event.response.claimsAndScopeOverrideDetails.accessTokenGeneration.claimsToAddOrOverride = {
    ...event.response.claimsAndScopeOverrideDetails.accessTokenGeneration.claimsToAddOrOverride,
    'custom:tenant_id': tenantId,
  };
  return event;
};
      `.trim()),
    });

    this.userPool.addTrigger(
      cognito.UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
      preTokenFn,
      cognito.LambdaVersion.V2_0,
    );

    // -------------------------------------------------------------------
    // Cognito Groups (maps to application roles via cognito:groups claim)
    // -------------------------------------------------------------------
    const roles = ['owner', 'admin', 'member'] as const;
    for (const role of roles) {
      new cognito.CfnUserPoolGroup(this, `Group-${role}`, {
        userPoolId: this.userPool.userPoolId,
        groupName: role,
      });
    }

    // -------------------------------------------------------------------
    // App Client (PKCE — no client secret, SPA-safe)
    // -------------------------------------------------------------------
    this.appClient = this.userPool.addClient('AppClient', {
      userPoolClientName: `${prefix}-app-client`,
      generateSecret: false,

      authFlows: {
        userPassword: true,
        userSrp: true,
      },

      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [allowedOrigin],
        logoutUrls: [allowedOrigin],
      },

      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),

      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
    });

    // -------------------------------------------------------------------
    // SQS Message Queue (FIFO) + Dead Letter Queue
    // -------------------------------------------------------------------
    const messageDlq = new sqs.Queue(this, 'MessageDLQ', {
      queueName: `${prefix}-messages-dlq.fifo`,
      fifo: true,
      retentionPeriod: cdk.Duration.days(14),
    });

    const messageQueue = new sqs.Queue(this, 'MessageQueue', {
      queueName: `${prefix}-messages.fifo`,
      fifo: true,
      contentBasedDeduplication: false,
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: messageDlq,
        maxReceiveCount: 3,
      },
    });

    // -------------------------------------------------------------------
    // Stack Outputs (paste into .env.dev after deploy)
    // -------------------------------------------------------------------
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
    });

    new cdk.CfnOutput(this, 'AppClientId', {
      value: this.appClient.userPoolClientId,
      description: 'Cognito App Client ID',
    });

    // JWKS URL for JWT signature validation
    const region = cdk.Stack.of(this).region;
    new cdk.CfnOutput(this, 'JwksUrl', {
      value: `https://cognito-idp.${region}.amazonaws.com/${this.userPool.userPoolId}/.well-known/jwks.json`,
      description: 'JWKS URL for JWT validation',
    });

    new cdk.CfnOutput(this, 'AllowedCorsOrigin', {
      value: allowedOrigin,
      description: 'Allowed CORS origin for the App Client',
    });

    new cdk.CfnOutput(this, 'MessageQueueUrl', {
      value: messageQueue.queueUrl,
      description: 'SQS Message Queue URL (FIFO)',
    });

    new cdk.CfnOutput(this, 'MessageQueueArn', {
      value: messageQueue.queueArn,
      description: 'SQS Message Queue ARN',
    });

    new cdk.CfnOutput(this, 'MessageDlqUrl', {
      value: messageDlq.queueUrl,
      description: 'SQS Dead Letter Queue URL (FIFO)',
    });
  }
}
