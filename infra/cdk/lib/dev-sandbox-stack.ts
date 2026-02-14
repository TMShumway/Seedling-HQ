import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

export interface DevSandboxStackProps extends cdk.StackProps {
  env_name: string;
  owner: string;
  allowedOrigin?: string;
}

export class DevSandboxStack extends cdk.Stack {
  public readonly userPool?: cognito.UserPool;
  public readonly appClient?: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: DevSandboxStackProps) {
    super(scope, id, props);

    const { env_name, owner, allowedOrigin = 'http://localhost:5173' } = props;
    // Sanitize context values for S3 naming constraints (lowercase, alphanumeric + hyphens)
    const safeName = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const prefix = `fsa-${safeName(env_name)}-${safeName(owner)}`;
    const isLocal = env_name === 'local';
    const skipCognito = this.node.tryGetContext('skipCognito') === 'true';

    // Tags applied to all resources in the stack
    cdk.Tags.of(this).add('app', 'fsa');
    cdk.Tags.of(this).add('env', env_name);
    cdk.Tags.of(this).add('owner', owner);

    // -------------------------------------------------------------------
    // S3 Upload Bucket
    // -------------------------------------------------------------------
    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `${prefix}-uploads`,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.GET,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: isLocal ? ['*'] : [allowedOrigin],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
        },
      ],
      // Security hardening
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Local: DESTROY only (autoDeleteObjects creates a Lambda that breaks LocalStack)
      // AWS dev sandbox: DESTROY + autoDeleteObjects for frictionless teardown
      // Note: This stack is for dev sandboxes only. A production stack would use RETAIN.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      ...(!isLocal && { autoDeleteObjects: true }),
    });

    // -------------------------------------------------------------------
    // Cognito User Pool (skipped for LocalStack — AUTH_MODE=local)
    // -------------------------------------------------------------------
    if (!skipCognito) {
      const userPool = new cognito.UserPool(this, 'UserPool', {
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

      // Pre-token-generation V2 Lambda trigger
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

      userPool.addTrigger(
        cognito.UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
        preTokenFn,
        cognito.LambdaVersion.V2_0,
      );

      // Cognito Groups
      const roles = ['owner', 'admin', 'member'] as const;
      for (const role of roles) {
        new cognito.CfnUserPoolGroup(this, `Group-${role}`, {
          userPoolId: userPool.userPoolId,
          groupName: role,
        });
      }

      // App Client (PKCE — no client secret, SPA-safe)
      const appClient = userPool.addClient('AppClient', {
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

      this.userPool = userPool;
      this.appClient = appClient;

      // Cognito outputs
      new cdk.CfnOutput(this, 'UserPoolId', {
        value: userPool.userPoolId,
        description: 'Cognito User Pool ID',
      });

      new cdk.CfnOutput(this, 'UserPoolArn', {
        value: userPool.userPoolArn,
        description: 'Cognito User Pool ARN',
      });

      new cdk.CfnOutput(this, 'AppClientId', {
        value: appClient.userPoolClientId,
        description: 'Cognito App Client ID',
      });

      const region = cdk.Stack.of(this).region;
      new cdk.CfnOutput(this, 'JwksUrl', {
        value: `https://cognito-idp.${region}.amazonaws.com/${userPool.userPoolId}/.well-known/jwks.json`,
        description: 'JWKS URL for JWT validation',
      });

      new cdk.CfnOutput(this, 'AllowedCorsOrigin', {
        value: allowedOrigin,
        description: 'Allowed CORS origin for the App Client',
      });
    }

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
    // Stack Outputs
    // -------------------------------------------------------------------
    new cdk.CfnOutput(this, 'S3BucketName', {
      value: uploadsBucket.bucketName,
      description: 'S3 Upload Bucket Name',
    });

    new cdk.CfnOutput(this, 'S3BucketArn', {
      value: uploadsBucket.bucketArn,
      description: 'S3 Upload Bucket ARN',
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
