#!/bin/bash
# Create the message queue (FIFO) for outbound comms worker
awslocal sqs create-queue \
  --queue-name seedling-messages.fifo \
  --attributes '{
    "FifoQueue": "true",
    "ContentBasedDeduplication": "false",
    "VisibilityTimeout": "60",
    "MessageRetentionPeriod": "345600",
    "DeadLetterTargetArn": "arn:aws:sqs:us-east-1:000000000000:seedling-messages-dlq.fifo",
    "maxReceiveCount": "3"
  }'

# Create the dead letter queue
awslocal sqs create-queue \
  --queue-name seedling-messages-dlq.fifo \
  --attributes '{
    "FifoQueue": "true",
    "MessageRetentionPeriod": "1209600"
  }'

# Re-create main queue now that DLQ exists (for proper redrive policy)
awslocal sqs delete-queue --queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/seedling-messages.fifo 2>/dev/null
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
