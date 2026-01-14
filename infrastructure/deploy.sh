#!/bin/bash

# Deploy DynamoDB tables for Subscription Tracker
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh dev

set -e

ENVIRONMENT=${1:-dev}
STACK_NAME="subscription-tracker-dynamodb-${ENVIRONMENT}"
TEMPLATE_FILE="dynamodb-tables.yaml"
REGION=${AWS_REGION:-us-east-1}

echo "Deploying DynamoDB tables for environment: ${ENVIRONMENT}"
echo "Stack name: ${STACK_NAME}"
echo "Region: ${REGION}"
echo ""

# Validate template
echo "Validating CloudFormation template..."
aws cloudformation validate-template \
  --template-body file://${TEMPLATE_FILE} \
  --region ${REGION}

echo ""
echo "Deploying stack..."

# Deploy or update stack
aws cloudformation deploy \
  --template-file ${TEMPLATE_FILE} \
  --stack-name ${STACK_NAME} \
  --parameter-overrides Environment=${ENVIRONMENT} \
  --region ${REGION} \
  --no-fail-on-empty-changeset

echo ""
echo "Stack deployment complete!"
echo ""

# Get outputs
echo "Table names for .env.local:"
echo "----------------------------"
aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query "Stacks[0].Outputs[?OutputKey=='EnvironmentVariables'].OutputValue" \
  --output text

echo ""
echo "Done!"
