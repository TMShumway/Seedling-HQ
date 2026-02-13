#!/bin/bash
# Create the seedling-uploads bucket for local development
awslocal s3 mb s3://seedling-uploads

# Set CORS configuration for browser-based presigned POST uploads
awslocal s3api put-bucket-cors --bucket seedling-uploads --cors-configuration '{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["PUT", "POST", "GET", "DELETE"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}'

echo "LocalStack S3 initialized: seedling-uploads bucket created with CORS"
