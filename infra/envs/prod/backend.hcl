bucket         = "warmpawz-terraform-state-057442119249"  # Using dev account bucket (since using dev resources)
key            = "prod/terraform.tfstate"
region         = "ap-south-1"
encrypt        = true
dynamodb_table = "warmpawz-terraform-locks"

