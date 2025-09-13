# Outputs for Seedling HQ Infrastructure

# Lambda Function Outputs
output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.api.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.api.arn
}

output "lambda_function_url" {
  description = "Lambda function URL (direct access)"
  value       = aws_lambda_function_url.api_url.function_url
}

output "lambda_invoke_arn" {
  description = "Lambda function invoke ARN"
  value       = aws_lambda_function.api.invoke_arn
}

# API Gateway Outputs
output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = aws_api_gateway_rest_api.api.id
}

output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = "https://${aws_api_gateway_rest_api.api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.stage_name}"
}

output "api_gateway_stage" {
  description = "Stage name of the API Gateway"
  value       = aws_api_gateway_stage.api.stage_name
}

output "api_gateway_deployment_id" {
  description = "Deployment ID of the API Gateway"
  value       = aws_api_gateway_deployment.api.id
}

# Health Check Endpoints
output "health_check_url_api_gateway" {
  description = "Health check URL via API Gateway"
  value       = "https://${aws_api_gateway_rest_api.api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.stage_name}/health"
}

output "health_check_url_lambda" {
  description = "Health check URL via Lambda function URL"
  value       = "${aws_lambda_function_url.api_url.function_url}health"
}

# CloudWatch Logs
output "lambda_log_group_name" {
  description = "CloudWatch log group name for Lambda function"
  value       = aws_cloudwatch_log_group.lambda_logs.name
}

output "api_gateway_log_group_name" {
  description = "CloudWatch log group name for API Gateway (if enabled)"
  value       = var.enable_api_gateway_logging ? aws_cloudwatch_log_group.api_gateway_logs[0].name : null
}

# Environment Information
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "project_name" {
  description = "Project name"
  value       = local.project_name
}

# IAM Role Information
output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution_role.arn
}

# Free Tier Usage Information
output "free_tier_info" {
  description = "Free tier configuration details"
  value = {
    lambda_memory_mb       = var.lambda_memory_size
    lambda_timeout_seconds = var.lambda_timeout
    lambda_concurrent_executions = aws_lambda_function.api.reserved_concurrent_executions
    api_gateway_rate_limit = var.api_gateway_throttle_rate_limit
    api_gateway_burst_limit = var.api_gateway_throttle_burst_limit
    log_retention_days     = var.log_retention_days
  }
}

# Quick Test Commands
output "test_commands" {
  description = "Commands to test the deployed API"
  value = {
    api_gateway_health = "curl https://${aws_api_gateway_rest_api.api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.stage_name}/health"
    lambda_url_health  = "curl ${aws_lambda_function_url.api_url.function_url}health"
    api_gateway_root   = "curl https://${aws_api_gateway_rest_api.api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.stage_name}/"
    lambda_url_root    = "curl ${aws_lambda_function_url.api_url.function_url}"
  }
}
