# Subscription Tracker
LedgerPulse — Subscription Tracker (MVP)
LedgerPulse is a full-stack subscription tracking application built with Next.js (App Router), Auth.js (NextAuth v5), and Amazon DynamoDB.
Users can create an account, sign in with credentials, and manage recurring subscriptions (create, view, update, delete). The application is deployed to Netlify and uses least-privilege IAM access for DynamoDB.
Live Demo:
https://ledgerpulse-cloud.netlify.app
Overview
This project represents a production-deployed MVP focused on:
•	Secure authentication with credential-based login
•	DynamoDB-backed data persistence
•	Server-side authorization and user scoping
•	Least-privilege IAM configuration
•	Real-world cloud deployment workflow
The goal of this project was to design and ship a complete cloud application from development through deployment, including IAM configuration, environment management, and production debugging.
Features
Authentication
•	Email + password registration
•	Secure password hashing using bcrypt
•	JWT session strategy via Auth.js
•	DynamoDB adapter for persistent user storage
Subscription Management
•	Create subscription
•	View user-scoped subscription list
•	Update subscription details
•	Delete subscription
•	Monthly and annual cost summaries
Cloud & Security
•	Deployed on Netlify (Next.js runtime)
•	DynamoDB as primary data store
•	Separate DynamoDB tables for:
o	Auth data
o	Subscription data
•	IAM user with scoped DynamoDB permissions
•	No secrets committed to source control
________________________________________
Tech Stack
•	Next.js (App Router)
•	React
•	Auth.js / NextAuth v5
•	Amazon DynamoDB
•	AWS SDK v3
•	TypeScript
•	Netlify
Architecture
DynamoDB Tables
AuthUsers
•	Used by Auth.js DynamoDB adapter
•	Includes a GSI (GSI1) for user lookup by email
•	Stores credentials, metadata, and adapter records
Subscriptions
•	Partition Key: userid
•	Sort Key: id
•	Stores user-scoped subscription records
Authorization Model
•	All API routes require an authenticated session
•	Subscription data is filtered by session.user.id
•	DynamoDB queries are always scoped to the authenticated user
IAM Design
Production IAM user is scoped to:
•	dynamodb:Query
•	dynamodb:GetItem
•	dynamodb:PutItem
•	dynamodb:UpdateItem
•	dynamodb:DeleteItem
Access is restricted to:
•	AuthUsers table + indexes
•	Subscriptions table + indexes
Local Development
Prerequisites
•	Node.js (LTS)
•	AWS account with:
o	AuthUsers table
o	Subscriptions table
•	IAM credentials with DynamoDB permissions
Install
cd web
npm install

Environment Variables
Create web/.env.local:
# Base URL
NEXTAUTH_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true

# Auth secret
NEXTAUTH_SECRET=your_random_secret
AUTH_SECRET=your_random_secret

# DynamoDB (Auth)
APP_AWS_REGION=us-east-1
APP_AWS_ACCESS_KEY_ID=your_key
APP_AWS_SECRET_ACCESS_KEY=your_secret
APP_AUTH_DYNAMODB_TABLE=AuthUsers

# DynamoDB (Subscriptions)
SUBSCRIPTIONS_TABLE=Subscriptions
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
Run
npm run dev
Visit:
http://localhost:3000
Deployment
The application is deployed to Netlify using the Next.js runtime.
Deployment requires:
•	Correct environment variables configured in Netlify
•	NEXTAUTH_URL and AUTH_URL set to the production domain
•	Proper OAuth callback URLs (if providers are enabled)
•	IAM user with least-privilege DynamoDB access
After dependency updates (e.g., security patches), deployment may require:
•	Clearing Netlify build cache
•	Rebuilding lockfile
•	Re-deploying without cache
________________________________________
Challenges Solved
During deployment, the following issues were diagnosed and resolved:
•	Next.js security patch blocking deployment (CVE-related runtime rejection)
•	Missing IAM permissions for DynamoDB GSI queries
•	Environment variable mismatch between local and production
•	Auth.js configuration errors in hosted environment
This project reflects a real-world cloud debugging workflow from failure to resolution.
________________________________________
Roadmap
Planned improvements beyond MVP:
•	Public landing page at root (/)
•	Consolidated DynamoDB client configuration
•	Infrastructure as Code (AWS SAM or CDK)
•	OAuth providers (Google/GitHub)
•	Subscription status toggling (active/cancelled)
•	Basic API testing
•	CI pipeline for build validation
________________________________________
License
MIT

