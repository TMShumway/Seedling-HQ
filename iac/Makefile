# Seedling HQ Infrastructure Makefile
# Convenient commands for managing AWS Lambda deployment

.PHONY: help init plan apply destroy clean validate fmt dev prod logs test

# Default environment
ENV ?= dev

# Default help command
help: ## Show this help message
	@echo "Seedling HQ Infrastructure Commands"
	@echo "==================================="
	@echo ""
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Environment options:"
	@echo "  ENV=dev     Deploy to development (default)"
	@echo "  ENV=prod    Deploy to production"
	@echo ""
	@echo "Examples:"
	@echo "  make init               # Initialize Terraform"
	@echo "  make plan ENV=dev       # Plan development deployment"
	@echo "  make apply ENV=prod     # Deploy to production"
	@echo "  make destroy ENV=dev    # Destroy development infrastructure"

init: ## Initialize Terraform
	@echo "🚀 Initializing Terraform..."
	terraform init

validate: ## Validate Terraform configuration
	@echo "✅ Validating Terraform configuration..."
	terraform validate

fmt: ## Format Terraform files
	@echo "📝 Formatting Terraform files..."
	terraform fmt -recursive

plan: validate ## Plan infrastructure changes
	@echo "📋 Planning infrastructure changes for $(ENV)..."
	terraform plan -var-file="environments/$(ENV).tfvars"

apply: validate ## Apply infrastructure changes
	@echo "🚢 Applying infrastructure changes for $(ENV)..."
	terraform apply -var-file="environments/$(ENV).tfvars"

destroy: ## Destroy infrastructure
	@echo "💥 Destroying infrastructure for $(ENV)..."
	@echo "⚠️  This will delete all resources. Are you sure? [y/N]"
	@read confirm && [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]
	terraform destroy -var-file="environments/$(ENV).tfvars"

clean: ## Clean build artifacts and Terraform files
	@echo "🧹 Cleaning build artifacts..."
	rm -rf builds/
	rm -rf .terraform/
	rm -f .terraform.lock.hcl
	rm -f terraform.tfstate*
	rm -f *.tfplan

# Development environment shortcuts
dev: ## Deploy to development environment
	@echo "🔧 Deploying to development environment..."
	$(MAKE) apply ENV=dev

dev-plan: ## Plan development deployment
	@echo "📋 Planning development deployment..."
	$(MAKE) plan ENV=dev

dev-destroy: ## Destroy development environment
	@echo "💥 Destroying development environment..."
	$(MAKE) destroy ENV=dev

# Production environment shortcuts
prod: ## Deploy to production environment
	@echo "🏭 Deploying to production environment..."
	$(MAKE) apply ENV=prod

prod-plan: ## Plan production deployment
	@echo "📋 Planning production deployment..."
	$(MAKE) plan ENV=prod

prod-destroy: ## Destroy production environment
	@echo "💥 Destroying production environment..."
	$(MAKE) destroy ENV=prod

# Utility commands
outputs: ## Show Terraform outputs
	@echo "📊 Terraform outputs for $(ENV):"
	terraform output

logs: ## View Lambda function logs (requires AWS CLI)
	@echo "📝 Viewing Lambda function logs..."
	@FUNCTION_NAME=$$(terraform output -raw lambda_function_name 2>/dev/null || echo "seedling-hq-api-$(ENV)"); \
	aws logs tail "/aws/lambda/$$FUNCTION_NAME" --follow

test: ## Test deployed API endpoints
	@echo "🧪 Testing API endpoints for $(ENV)..."
	@echo ""
	@echo "Testing health endpoint via API Gateway:"
	@API_URL=$$(terraform output -raw api_gateway_url 2>/dev/null); \
	if [ -n "$$API_URL" ]; then \
		curl -s "$$API_URL/health" | jq . || curl -s "$$API_URL/health"; \
	else \
		echo "❌ API Gateway URL not found. Run 'make apply ENV=$(ENV)' first."; \
	fi
	@echo ""
	@echo "Testing health endpoint via Lambda URL:"
	@LAMBDA_URL=$$(terraform output -raw lambda_function_url 2>/dev/null); \
	if [ -n "$$LAMBDA_URL" ]; then \
		curl -s "$$LAMBDA_URL/health" | jq . || curl -s "$$LAMBDA_URL/health"; \
	else \
		echo "❌ Lambda URL not found. Run 'make apply ENV=$(ENV)' first."; \
	fi

status: ## Show deployment status and URLs
	@echo "📊 Deployment Status for $(ENV)"
	@echo "================================"
	@echo ""
	@if terraform output lambda_function_name >/dev/null 2>&1; then \
		echo "✅ Infrastructure is deployed"; \
		echo ""; \
		echo "🔗 API URLs:"; \
		echo "  API Gateway: $$(terraform output -raw api_gateway_url)"; \
		echo "  Lambda URL:  $$(terraform output -raw lambda_function_url)"; \
		echo ""; \
		echo "🩺 Health Check URLs:"; \
		echo "  API Gateway: $$(terraform output -raw health_check_url_api_gateway)"; \
		echo "  Lambda URL:  $$(terraform output -raw health_check_url_lambda)"; \
		echo ""; \
		echo "📝 CloudWatch Logs:"; \
		echo "  Log Group: $$(terraform output -raw lambda_log_group_name)"; \
	else \
		echo "❌ Infrastructure not deployed"; \
		echo "Run 'make apply ENV=$(ENV)' to deploy"; \
	fi

# Build and prepare API
build-api: ## Build the API before deployment
	@echo "🔨 Building API..."
	@cd ../apps/api && yarn install && yarn build

# Full deployment workflow
deploy: build-api plan apply test ## Full deployment workflow (build + plan + apply + test)
	@echo "🎉 Deployment complete!"

# Quick deployment (skip plan)
quick-deploy: build-api apply ## Quick deployment (build + apply, skip plan)
	@echo "⚡ Quick deployment complete!"
