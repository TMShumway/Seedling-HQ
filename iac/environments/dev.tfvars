# Development Environment Configuration

# Basic Configuration
environment = "dev"
aws_region  = "us-east-1"

# Lambda Configuration (Free Tier Optimized)
lambda_memory_size = 128  # Minimum for free tier
lambda_timeout     = 15   # Short timeout for dev

# API Gateway Configuration (Free Tier Friendly)
api_gateway_throttle_rate_limit  = 10  # Requests per second
api_gateway_throttle_burst_limit = 20  # Burst capacity

# CORS Configuration (Permissive for development)
cors_origins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://*.vercel.app"
]

# Logging Configuration
log_retention_days         = 7     # Keep logs for 7 days in dev
enable_api_gateway_logging = true  # Enable for debugging

# Stage Configuration
stage_name = "dev"
