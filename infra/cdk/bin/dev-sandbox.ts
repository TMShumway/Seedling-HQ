#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

const app = new cdk.App();

const env = app.node.tryGetContext('env') as string | undefined;
const owner = app.node.tryGetContext('owner') as string | undefined;

if (!env) {
  throw new Error('Missing required context: env (e.g. --context env=dev)');
}
if (!owner) {
  throw new Error('Missing required context: owner (e.g. --context owner=tim)');
}

// Stack instantiation added in Phase 2
