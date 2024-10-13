# Next.js App Runner Deployment with CloudFront

This project demonstrates how to deploy a Next.js application using AWS App Runner and CloudFront. It uses the AWS CDK to define and deploy the infrastructure.  The project is managed with projen and includes several custom tasks to support the development process.

## Architecture

The architecture consists of the following components:

1. A Next.js application
2. AWS App Runner to host and run the Next.js application
3. Amazon CloudFront as a content delivery network (CDN) in front of App Runner
4. AWS CDK to define and deploy the infrastructure

## Key Features

- Serverless deployment of a Next.js application using AWS App Runner
- CloudFront distribution with custom origin request policy
- Automated CI/CD pipeline using GitHub Actions
- Infrastructure as Code using AWS CDK

## Prerequisites

- AWS Account
- Node.js (version 18 or later)
- AWS CDK CLI
- Docker (for local development and testing)

## Getting Started

1. Clone the repository:

   ```
   git clone https://github.com/schuettc/next-js-app-runner-deployment.git
   cd next-js-app-runner-deployment
   ```

2. Install dependencies:

   ```
   yarn 
   ```

3. Deploy the stack:

   ```
   yarn launch
   ```

## Project Structure

- `src/`: Contains the CDK infrastructure code
  - `appRunner.ts`: Defines the App Runner service
  - `cloudfront.ts`: Sets up the CloudFront distribution
  - `next-js-app-runner-deployment.ts`: Main stack definition
- `src/resources/app/`: Contains the Next.js application code

## Custom Origin Request Policy

This project implements a custom origin request policy for CloudFront, which is required when using App Runner as the origin. The policy allows specific headers to be forwarded to the origin:

```typescript:src/cloudfront.ts
    const customOriginRequestPolicy = new OriginRequestPolicy(
      this,
      'UserAgentRefererHeadersPolicy',
      {
        headerBehavior: OriginRequestHeaderBehavior.allowList(
          'User-Agent',
          'Referer',
        ),
      },
    );
```

This custom policy ensures that the `User-Agent` and `Referer` headers are forwarded to the App Runner service, which solves the 404 error that occurs when using AppRunner as the origin for a CloudFront distribution.

https://docs.aws.amazon.com/apprunner/latest/dg/request-route-404-troubleshoot.html


## Deployment

The project includes a GitHub Actions workflow for automated deployments. When you push changes to the `main` branch, it will automatically deploy the updated stack to AWS.

To deploy manually:

1. Configure your AWS credentials
2. Run `yarn deploy`

### projen configuration

```typescript
const deploy = project.github?.addWorkflow('deploy');
deploy?.on({
  push: {
    branches: ['main'],
  },
  workflow_dispatch: {},
});

deploy?.addJobs({
  deploy: {
    runsOn: ['ubuntu-latest'],
    permissions: {
      contents: JobPermission.READ,
      id_token: JobPermission.WRITE,
    },
    steps: [
      { uses: 'actions/checkout@v4' },
      {
        uses: 'actions/setup-node@v4',
        with: {
          'node-version': '18',
        },
      },
      { run: 'yarn install --frozen-lockfile' },
      {
        uses: 'aws-actions/configure-aws-credentials@v4',
        with: {
          'aws-access-key-id': '${{ secrets.AWS_ACCESS_KEY_ID }}',
          'aws-secret-access-key': '${{ secrets.AWS_SECRET_ACCESS_KEY }}',
          'aws-region': '${{ secrets.AWS_REGION }}',
        },
      },
      { run: 'npx cdk deploy --require-approval never' },
    ],
  },
});
```

## Local Development

To run the Next.js application locally:

1. Navigate to the app directory:

   ```
   cd src/resources/app
   ```

2. Install dependencies:

   ```
   yarn
   ```

3. Start the development server:

   ```
   yarn dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## GitHub Updates with Projen

The project uses projen to manage the project and the Next.js application.  We have replaced the default projen upgrade with a custom upgrade.  This allows us to upgrade the dependencies for both the main project and the Next.js application in a single step.

```typescript
const upgradeWorkflow = project.github?.addWorkflow('upgrade');
upgradeWorkflow?.on({
  schedule: [{ cron: '0 0 * * 1' }],
  workflow_dispatch: {},
});

upgradeWorkflow?.addJobs({
  upgrade: {
    runsOn: ['ubuntu-latest'],
    permissions: {
      contents: JobPermission.WRITE,
      pullRequests: JobPermission.WRITE,
    },
    steps: [
      { uses: 'actions/checkout@v4' },
      { uses: 'actions/setup-node@v4', with: { 'node-version': '18' } },
      { run: 'yarn install' },
      { run: 'npx projen upgrade:projen' },
      { run: 'npx projen upgrade:nextjs' },
      {
        name: 'Create Pull Request',
        uses: 'peter-evans/create-pull-request@v6',
        with: {
          'token': '${{ secrets.PROJEN_GITHUB_TOKEN }}',
          'commit-message': 'chore: upgrade dependencies',
          'branch': 'projen-upgrade',
          'title': 'chore: upgrade dependencies',
          'body':
            'This PR upgrades project dependencies, including projen and Next.js. Auto-generated by projen upgrade workflow.',
        },
      },
    ],
  },
});

project.addTask('upgrade:nextjs', {
  exec: ['cd src/resources/app', 'yarn upgrade --latest', 'cd ../../..'].join(
    ' && ',
  ),
});

project.addTask('upgrade:projen', {
  description: 'Upgrade projen dependencies',
  steps: [
    { exec: 'yarn upgrade projen @projen/awscdk-app-ts' },
    { exec: 'npx projen' },
  ],
});
```