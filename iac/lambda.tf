# AWS Lambda Function Configuration

# IAM role for Lambda function
resource "aws_iam_role" "lambda_execution_role" {
  name = "${local.function_name}-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Attach basic execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_execution_role.name
}

# CloudWatch log group for Lambda
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}

# Create deployment package
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/builds/${local.function_name}.zip"
  
  # Include the built API code
  source_dir = "${var.api_source_path}/dist"
  
  depends_on = [null_resource.build_api]
}

# Build the API before packaging
resource "null_resource" "build_api" {
  # Trigger rebuild when source changes
  triggers = {
    package_json = filemd5("${var.api_source_path}/package.json")
    tsconfig     = filemd5("${var.api_source_path}/tsconfig.json")
    # Note: For production, you'd want to track all source files
  }

  provisioner "local-exec" {
    working_dir = var.api_source_path
    command     = <<-EOT
      echo "Building API for Lambda deployment..."
      yarn install --production=false
      yarn build
      echo "API build completed"
    EOT
  }
}

# Lambda function
resource "aws_lambda_function" "api" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = local.function_name
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "lambda.handler"
  runtime         = var.lambda_runtime
  
  # Free tier optimized settings
  memory_size = var.lambda_memory_size
  timeout     = var.lambda_timeout
  
  # Performance optimization
  reserved_concurrent_executions = 5  # Limit to avoid unexpected charges
  
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      NODE_ENV    = var.environment == "prod" ? "production" : "development"
      STAGE       = var.environment
      API_VERSION = "1.0.0"
      # Add more environment variables as needed
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_cloudwatch_log_group.lambda_logs,
    data.archive_file.lambda_zip
  ]

  tags = local.common_tags
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway_invoke" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Lambda function URL (alternative to API Gateway for simple use cases)
resource "aws_lambda_function_url" "api_url" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"  # Consider using AWS_IAM for production
  
  cors {
    allow_credentials = false
    allow_origins     = var.cors_origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["date", "keep-alive", "content-type", "authorization"]
    expose_headers    = ["date", "keep-alive"]
    max_age           = 86400
  }

}
