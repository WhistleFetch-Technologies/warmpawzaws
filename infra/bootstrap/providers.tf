provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "Warmpawz"
      ManagedBy   = "terraform"
      Repository  = "warmpawzecodev"
      Environment = "bootstrap"
    }
  }
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "ap-south-1"
}

