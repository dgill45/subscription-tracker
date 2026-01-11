#!/bin/bash

# Create the AuthUsers table for NextAuth.js DynamoDB adapter
# This table stores users, accounts, sessions, and verification tokens

TABLE_NAME="${AUTH_DYNAMODB_TABLE:-AuthUsers}"
REGION="${AWS_REGION:-us-east-1}"

echo "Creating DynamoDB table: $TABLE_NAME in region: $REGION"

aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
    AttributeName=GSI1PK,AttributeType=S \
    AttributeName=GSI1SK,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "GSI1",
        "KeySchema": [
          {"AttributeName": "GSI1PK", "KeyType": "HASH"},
          {"AttributeName": "GSI1SK", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      }
    ]' \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region "$REGION"

echo "Table created successfully!"
echo ""
echo "Note: The DynamoDB adapter uses the following structure:"
echo "  - pk: Primary key (USER#<id>, ACCOUNT#<provider>#<providerAccountId>, etc.)"
echo "  - sk: Sort key"
echo "  - GSI1: Global Secondary Index for lookups by email, provider account, etc."
