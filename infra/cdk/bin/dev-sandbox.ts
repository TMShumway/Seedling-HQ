#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DevSandboxStack } from '../lib/dev-sandbox-stack.js';

const app = new cdk.App();

const env = app.node.tryGetContext('env') as string | undefined;
const owner = app.node.tryGetContext('owner') as string | undefined;

if (!env) {
  throw new Error('Missing required context: env (e.g. --context env=dev)');
}
if (!owner) {
  throw new Error('Missing required context: owner (e.g. --context owner=tim)');
}

const allowedOrigin = (app.node.tryGetContext('allowedOrigin') as string | undefined)
  ?? 'http://localhost:5173';

new DevSandboxStack(app, `fsa-${env}-${owner}`, {
  env_name: env,
  owner,
  allowedOrigin,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
