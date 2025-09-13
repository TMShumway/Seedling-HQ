# Seedling HQ Infrastructure as Code
# AWS Lambda setup optimized for free tier

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "SeedlingHQ"
      Environment = var.environment
      ManagedBy   = "Terraform"
      CreatedBy   = "IaC"
    }
  }
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Local variables
locals {
  project_name = "seedling-hq"
  function_name = "${local.project_name}-api-${var.environment}"
  
  # Free tier optimized settings
  lambda_memory_mb = 128  # Free tier: up to 128MB
  lambda_timeout_seconds = 15  # Keep low for free tier
  
  common_tags = {
    Project     = "SeedlingHQ"
    Environment = var.environment
    Component   = "API"
  }
}
