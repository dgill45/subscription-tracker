# LedgerPulse — Subscription Tracker

A full-stack subscription tracking application built with **Next.js**, **Auth.js**, and **Amazon DynamoDB**.

LedgerPulse allows users to create an account, sign in securely, and manage recurring subscriptions through a user-scoped dashboard.

**Live Demo:** https://ledgerpulse-cloud.netlify.app

---

## Overview

LedgerPulse is a production-deployed MVP designed to demonstrate a complete cloud application workflow from local development through deployment.

The project focuses on:

* Secure credential-based authentication
* DynamoDB-backed persistence
* Server-side authorization
* User-scoped application data
* Least-privilege IAM permissions
* Production deployment and debugging

The goal was not simply to build a subscription tracker, but to design, secure, deploy, and troubleshoot a complete cloud-backed application.

---

## Features

### Authentication

* Email and password registration
* Secure password hashing with `bcrypt`
* JWT session strategy using Auth.js
* Persistent authentication data stored in DynamoDB
* Protected server-side routes

### Subscription Management

Authenticated users can:

* Create subscriptions
* View their subscriptions
* Update subscription details
* Delete subscriptions
* View monthly cost totals
* View annual cost totals

All subscription data is scoped to the authenticated user.

### Cloud & Security

* Production deployment on Netlify
* Amazon DynamoDB as the primary data store
* Separate DynamoDB tables for authentication and subscription data
* Least-privilege IAM permissions
* Environment-based secret management
* No AWS credentials or application secrets committed to source control

---

## Tech Stack

| Technology            | Purpose                               |
| --------------------- | ------------------------------------- |
| Next.js               | Application framework                 |
| React                 | User interface                        |
| TypeScript            | Application development               |
| Auth.js / NextAuth v5 | Authentication and session management |
| Amazon DynamoDB       | Persistent data storage               |
| AWS SDK v3            | DynamoDB integration                  |
| bcrypt                | Password hashing                      |
| Netlify               | Production deployment                 |

---

## Architecture

LedgerPulse uses two DynamoDB tables.

### `AuthUsers`

Used by the Auth.js DynamoDB adapter for authentication-related data.

The table stores:

* User records
* Credential metadata
* Auth.js adapter records

A Global Secondary Index (`GSI1`) supports user lookup by email.

### `Subscriptions`

Stores recurring subscription records.

**Partition Key**

```text
userid
```

**Sort Key**

```text
id
```

Each subscription record is associated with the authenticated user's ID.

---

## Authorization Model

All subscription operations require an authenticated session.

The application uses:

```text
session.user.id
```

to scope DynamoDB operations to the currently authenticated user.

This prevents one user from retrieving or modifying another user's subscription records.

The application does not perform unrestricted table scans for user subscription data. Queries are scoped to the authenticated user's partition key.

---

## IAM Design

The production IAM user follows a least-privilege model.

Allowed DynamoDB operations include:

```text
dynamodb:Query
dynamodb:GetItem
dynamodb:PutItem
dynamodb:UpdateItem
dynamodb:DeleteItem
```

Access is restricted to:

* `AuthUsers`
* `AuthUsers` indexes
* `Subscriptions`
* `Subscriptions` indexes

---

## Local Development

### Prerequisites

You will need:

* Node.js LTS
* An AWS account
* An `AuthUsers` DynamoDB table
* A `Subscriptions` DynamoDB table
* AWS credentials with appropriate DynamoDB permissions

### Install Dependencies

```bash
cd web
npm install
```

### Environment Variables

Create:

```text
web/.env.local
```

Add the following configuration.

#### Application URLs

```env
NEXTAUTH_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
```

#### Authentication Secret

```env
NEXTAUTH_SECRET=your_random_secret
AUTH_SECRET=your_random_secret
```

#### DynamoDB Authentication Configuration

```env
APP_AWS_REGION=us-east-1
APP_AWS_ACCESS_KEY_ID=your_key
APP_AWS_SECRET_ACCESS_KEY=your_secret
APP_AUTH_DYNAMODB_TABLE=AuthUsers
```

#### DynamoDB Subscription Configuration

```env
SUBSCRIPTIONS_TABLE=Subscriptions
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

### Run Locally

```bash
npm run dev
```

Then visit:

```text
http://localhost:3000
```

---

## Deployment

LedgerPulse is deployed to **Netlify** using the Next.js runtime.

Production deployment requires:

* Application environment variables configured in Netlify
* `NEXTAUTH_URL` configured for the production domain
* `AUTH_URL` configured for the production domain
* Correct callback URLs if OAuth providers are enabled
* IAM credentials with the required DynamoDB permissions

After dependency or security updates, deployment may also require:

* Clearing the Netlify build cache
* Rebuilding the lockfile
* Redeploying without cached dependencies

---

## Challenges Solved

Building and deploying the application required troubleshooting several real-world cloud and production issues.

### DynamoDB IAM Permissions

Authentication required DynamoDB queries against a Global Secondary Index.

The initial IAM configuration did not include sufficient permissions for GSI queries, causing authentication failures in production.

The policy was updated to grant the required access while maintaining least-privilege permissions.

### Local vs. Production Environment Configuration

Differences between local environment variables and hosted environment variables caused authentication issues during deployment.

The production configuration was corrected to align Auth.js URLs, secrets, and AWS credentials with the hosted environment.

### Auth.js Production Configuration

Authentication behavior that worked locally required additional configuration when running in the hosted environment.

These issues required debugging the interaction between:

* Auth.js
* Netlify
* environment variables
* DynamoDB

### Next.js Security Update

A Next.js security-related runtime restriction prevented deployment until project dependencies were updated.

Resolving the issue required:

* Updating dependencies
* Rebuilding the lockfile
* Clearing cached deployment artifacts
* Redeploying the application

These problems made the project an exercise not only in application development, but also in production troubleshooting and cloud operations.

---

## Current Status

**MVP deployed and functional**

The application currently supports:

```text
Registration
    ↓
Authentication
    ↓
User Session
    ↓
Subscription Dashboard
    ↓
Create / View / Update / Delete
    ↓
DynamoDB Persistence
```

---

## Roadmap

Planned improvements include:

* Public landing page at `/`
* Consolidated DynamoDB client configuration
* Infrastructure as Code using AWS SAM or AWS CDK
* Google and GitHub OAuth providers
* Subscription status tracking
* Active / cancelled subscription states
* API testing
* Automated build validation
* CI pipeline
* Improved dashboard analytics

---

## What This Project Demonstrates

LedgerPulse demonstrates hands-on experience with:

* Full-stack application development
* Authentication and authorization
* NoSQL data modeling
* AWS DynamoDB integration
* IAM least-privilege design
* Environment and secret management
* Production deployment
* Cloud troubleshooting
* Debugging differences between local and hosted environments

---

## License

MIT
