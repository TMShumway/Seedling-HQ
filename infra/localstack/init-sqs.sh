#!/bin/bash
# Create the dead letter queue first (must exist before redrive policy references it)
awslocal sqs create-queue \
  --queue-name seedling-messages-dlq.fifo \
  --attributes '{
    "FifoQueue": "true",
    "MessageRetentionPeriod": "1209600"
  }'

# Create the main message queue with redrive policy pointing to the DLQ
awslocal sqs create-queue \
  --queue-name seedling-messages.fifo \
  --attributes "{
    \"FifoQueue\": \"true\",
    \"ContentBasedDeduplication\": \"false\",
    \"VisibilityTimeout\": \"60\",
    \"MessageRetentionPeriod\": \"345600\",
    \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"arn:aws:sqs:us-east-1:000000000000:seedling-messages-dlq.fifo\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"
  }"

echo "LocalStack SQS initialized: seedling-messages.fifo + DLQ created"
