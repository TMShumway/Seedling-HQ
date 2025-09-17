# Production Environment Configuration

# Basic Configuration
environment = "prod"
aws_region  = "us-east-1"

# Lambda Configuration (Still Free Tier Optimized but with better performance)
lambda_memory_size = 128  # Can increase to 256 if needed
lambda_timeout     = 30   # Longer timeout for production

# API Gateway Configuration (Production Limits)
api_gateway_throttle_rate_limit  = 50   # Higher rate limit for production
api_gateway_throttle_burst_limit = 100  # Higher burst capacity

# CORS Configuration (Restrictive for production)
cors_origins = [
  "https://your-production-domain.com",
  "https://www.your-production-domain.com",
  "https://your-app.vercel.app"
]

# Logging Configuration
log_retention_days         = 30    # Keep logs longer in production
enable_api_gateway_logging = true  # Keep logging enabled for monitoring

# Stage Configuration
stage_name = "v1"
