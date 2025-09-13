# Seedling HQ Infrastructure as Code

This directory contains Terraform configuration for deploying the Seedling HQ API to AWS Lambda with API Gateway, optimized for the **AWS Free Tier**.

## 🎯 Overview

- **Framework**: Terraform for Infrastructure as Code
- **Target**: AWS Lambda + API Gateway
- **Optimization**: Free tier optimized settings
- **Environments**: dev, staging, prod support
- **Cost**: Minimal costs within AWS Free Tier limits

## 📋 Prerequisites

### Required Tools
1. **Terraform** (>= 1.0)
   ```bash
   # Install via Homebrew (macOS)
   brew install terraform
   
   # Verify installation
   terraform version
   ```

2. **AWS CLI** (configured with credentials)
   ```bash
   # Install AWS CLI
   brew install awscli
   
   # Configure credentials
   aws configure
   ```

3. **Node.js & Yarn** (for building the API)
   ```bash
   # Already installed in your project
   node --version
   yarn --version
   ```

### AWS Account Setup
1. **Create AWS Account** (if not already done)
2. **Create IAM User** with programmatic access
3. **Attach Policies**:
   - `AWSLambdaFullAccess`
   - `AmazonAPIGatewayAdministrator`
   - `CloudWatchFullAccess`
   - `IAMFullAccess`

## 🚀 Quick Start

### 1. Initialize Terraform
```bash
cd iac
terraform init
```

### 2. Plan Deployment (Development)
```bash
terraform plan -var-file="environments/dev.tfvars"
```

### 3. Deploy to Development
```bash
terraform apply -var-file="environments/dev.tfvars"
```

### 4. Test the Deployment
```bash
# Get the API Gateway URL from outputs
terraform output api_gateway_url

# Test health endpoint
curl "$(terraform output -raw api_gateway_url)/health"
```

## 📁 File Structure

```
iac/
├── main.tf                 # Main Terraform configuration
├── variables.tf            # Variable definitions
├── lambda.tf              # Lambda function configuration
├── api_gateway.tf         # API Gateway configuration
├── outputs.tf             # Output values
├── environments/          # Environment-specific configurations
│   ├── dev.tfvars        # Development environment
│   └── prod.tfvars       # Production environment
├── builds/               # Generated deployment packages (auto-created)
└── README.md             # This file
```

## ⚙️ Configuration

### Environment Variables
Each environment has its own configuration file:

#### Development (`environments/dev.tfvars`)
- **Memory**: 128MB (minimum for free tier)
- **Timeout**: 15 seconds
- **Rate Limit**: 10 requests/second
- **CORS**: Permissive (localhost + vercel.app)
- **Logs**: 7 days retention

#### Production (`environments/prod.tfvars`)
- **Memory**: 128MB (can increase if needed)
- **Timeout**: 30 seconds
- **Rate Limit**: 50 requests/second
- **CORS**: Restrictive (production domains only)
- **Logs**: 30 days retention

### Free Tier Optimizations

#### Lambda Function
- **Memory**: 128MB (minimum, free tier includes 400,000 GB-seconds/month)
- **Timeout**: 15s dev / 30s prod (to avoid long-running charges)
- **Concurrency**: Limited to 5 (prevents unexpected scaling costs)
- **Runtime**: Node.js 18.x (latest supported)

#### API Gateway
- **Type**: Regional (more cost-effective than Edge)
- **Throttling**: Conservative limits (10-50 req/sec)
- **Caching**: Disabled (would incur charges)
- **Data Transfer**: Minimized with compression

#### CloudWatch Logs
- **Retention**: 7 days dev / 30 days prod (minimize storage costs)
- **Level**: INFO (avoid excessive DEBUG logs)

## 🛠️ Commands

### Basic Operations
```bash
# Initialize Terraform
terraform init

# Format configuration files
terraform fmt

# Validate configuration
terraform validate

# Plan changes
terraform plan -var-file="environments/dev.tfvars"

# Apply changes
terraform apply -var-file="environments/dev.tfvars"

# Destroy infrastructure
terraform destroy -var-file="environments/dev.tfvars"
```

### Environment-Specific Deployments
```bash
# Development
terraform apply -var-file="environments/dev.tfvars"

# Production
terraform apply -var-file="environments/prod.tfvars"
```

### View Outputs
```bash
# Show all outputs
terraform output

# Show specific output
terraform output api_gateway_url
terraform output lambda_function_url

# Show outputs in JSON format
terraform output -json
```

## 🧪 Testing

### Health Check Endpoints
After deployment, test these endpoints:

```bash
# Via API Gateway
curl "$(terraform output -raw health_check_url_api_gateway)"

# Via Lambda Function URL (direct)
curl "$(terraform output -raw health_check_url_lambda)"

# Root endpoint
curl "$(terraform output -raw api_gateway_url)/"
```

### Expected Response
```json
{
  "status": "ok",
  "timestamp": "2025-01-13T17:23:22.123Z",
  "stage": "dev",
  "version": "1.0.0"
}
```

## 📊 Cost Estimation

### AWS Free Tier Limits (Monthly)
- **Lambda**: 1M requests + 400,000 GB-seconds compute time
- **API Gateway**: 1M API calls received
- **CloudWatch Logs**: 5GB of ingested logs
- **Data Transfer**: 1GB out

### Estimated Usage (Small Application)
- **Lambda Invocations**: ~10,000/month (well within 1M limit)
- **Compute Time**: ~50 GB-seconds/month (well within 400K limit)
- **API Calls**: ~10,000/month (well within 1M limit)
- **Logs**: ~500MB/month (well within 5GB limit)

**Expected Cost**: $0.00/month (within free tier)

## 🔧 Troubleshooting

### Common Issues

#### 1. "No credentials found"
```bash
# Configure AWS credentials
aws configure

# Or use environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"
```

#### 2. "API build failed"
```bash
# Ensure API is buildable
cd ../packages/api
yarn install
yarn build
```

#### 3. "Deployment package too large"
- Check that `dist/` directory exists in `packages/api/`
- Ensure TypeScript compilation is successful
- Verify no unnecessary files in build output

#### 4. "Permission denied"
- Check IAM user has required permissions
- Verify AWS credentials are configured correctly

### Deployment Validation
```bash
# Check if Lambda function is created
aws lambda get-function --function-name "$(terraform output -raw lambda_function_name)"

# Check API Gateway
aws apigateway get-rest-api --rest-api-id "$(terraform output -raw api_gateway_id)"

# View CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/"
```

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy Infrastructure

on:
  push:
    branches: [main]
    paths: ['iac/**', 'packages/api/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: 1.6.0
          
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
          
      - name: Terraform Init
        run: terraform init
        working-directory: iac
        
      - name: Terraform Plan
        run: terraform plan -var-file="environments/prod.tfvars"
        working-directory: iac
        
      - name: Terraform Apply
        run: terraform apply -auto-approve -var-file="environments/prod.tfvars"
        working-directory: iac
```

## 📚 Next Steps

1. **Deploy to Development**
   ```bash
   terraform apply -var-file="environments/dev.tfvars"
   ```

2. **Test API Endpoints**
   - Health check
   - User endpoints
   - Error handling

3. **Set up Monitoring**
   - CloudWatch dashboards
   - Log analysis
   - Performance metrics

4. **Production Deployment**
   - Update CORS origins in `prod.tfvars`
   - Apply production configuration
   - Set up domain name (optional)

5. **Security Enhancements**
   - API Gateway authorizers
   - Lambda function environment variables
   - Secrets management with AWS Secrets Manager

## 🛡️ Security Considerations

- **API Gateway**: Consider adding API keys or authorizers for production
- **Lambda**: Environment variables for sensitive data
- **IAM**: Principle of least privilege for all roles
- **CORS**: Restrict origins in production environment
- **Logging**: Avoid logging sensitive information

## 📖 Additional Resources

- [AWS Lambda Free Tier](https://aws.amazon.com/lambda/pricing/)
- [API Gateway Pricing](https://aws.amazon.com/api-gateway/pricing/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Free Tier Usage Monitoring](https://console.aws.amazon.com/billing/home#/freetier)
