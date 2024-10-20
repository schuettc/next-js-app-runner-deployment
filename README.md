# Next.js SSR App Runner Deployment with CloudFront

This project demonstrates how to deploy a Next.js SSR application using AWS App Runner and CloudFront. It uses an AWS CDK to define and deploy the infrastructure. The project is managed with projen and includes several custom tasks to support the development process.

## Architecture

The architecture consists of the following components:

1. A Next.js application
2. AWS App Runner to host and run the Next.js application
3. Amazon CloudFront as a content delivery network (CDN) in front of App Runner
4. Lambda@Edge to rewrite headers and support dynamic routing
5. Route53 ARecords for DNS
6. AWS CDK to define and deploy the infrastructure
7. GitHub actions for CI/CD

## Prerequisites

- AWS Account
- Node.js (version 18 or later)
- AWS CDK CLI
- Docker (for local development and testing)

## Getting Started

Clone the repository:

```
git clone https://github.com/schuettc/next-js-app-runner-deployment.git
cd next-js-app-runner-deployment
```

Install dependencies:

```
yarn
```

Deploy the stack:

```
yarn launch
```

## Project Structure

- `src/`: Contains the CDK infrastructure code
  - `appRunner.ts`: Defines the App Runner service
  - `cloudfront.ts`: Sets up the CloudFront distribution
  - `lambda.ts`: Creates the Lambda@Edge function
  - `route53.ts`: Defines the DNS records
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

## Lambda@Edge for Header Rewriting

This project uses a Lambda@Edge function to rewrite headers, which is crucial for supporting dynamic routing in Next.js when using App Runner behind CloudFront. The function is associated with both the Origin Request and Viewer Request events in CloudFront.

Here's the Lambda@Edge function code:

```typescript:src/resources/lambdaEdge/index.ts
import { CloudFrontRequestEvent, CloudFrontRequestResult } from 'aws-lambda';

export const handler = async (
  event: CloudFrontRequestEvent,
): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  const origin = request.origin?.custom;

  if (origin && origin.domainName) {
    request.headers.host = [{ key: 'Host', value: origin.domainName }];
  }

  return request;
};

```

This function rewrites the `Host` header to match the origin's domain name, ensuring that App Runner receives the correct host information. This is essential for Next.js to properly handle dynamic routes.

The Lambda@Edge function is associated with CloudFront in the following way:

```typescript
        edgeLambdas: [
          {
            functionVersion: lambdaEdgeFunction.function.currentVersion,
            eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
          },
          {
            functionVersion: lambdaEdgeFunction.function.currentVersion,
            eventType: LambdaEdgeEventType.VIEWER_REQUEST,
          },
        ],
      },
```

By attaching this function to both the Origin Request and Viewer Request events, we ensure that the headers are properly rewritten for all incoming requests, allowing Next.js to handle dynamic routing correctly when deployed on App Runner behind CloudFront.

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

## Server Side Rendering

This NextJS includes support for Server Side Rendering (SRR) through dynamic routes and API routes:

```typescript
export default function Post({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Post {params.id}</h1>
      <p>This is a dynamic route for post with ID: {params.id}</p>
    </div>
  );
}
```

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Hello from the API!' });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ message: 'Hello from the API!', data: body });
}
```

## Local Development

To run the Next.js application locally:

Navigate to the app directory:

```
cd src/resources/app
```

Install dependencies:

```
yarn
```

Start the development server:

```
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser

## GitHub Updates with Projen

The project uses projen to manage the project and the Next.js application. We have replaced the default projen upgrade with a custom upgrade. This allows us to upgrade the dependencies for both the main project and the Next.js application in a single step.

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

## Route 53 DNS Configuration

This project uses Amazon Route 53 to manage DNS records for the deployed application. The `Route53Resources` construct in `src/route53.ts` sets up the necessary DNS records to point your domain to the CloudFront distribution.

Two A records are created:

- One for the apex domain (e.g., example.com)
- One for the www subdomain (e.g., www.example.com)

Both A records are set up as alias records pointing to the CloudFront distribution:

```typescript
new ARecord(this, 'AliasRecord', {
  zone: hostedZone,
  target: RecordTarget.fromAlias(new CloudFrontTarget(props.distribution)),
  recordName: `${props.domainName}.`,
});

new ARecord(this, 'WWWAliasRecord', {
  zone: hostedZone,
  target: RecordTarget.fromAlias(new CloudFrontTarget(props.distribution)),
  recordName: `www.${props.domainName}.`,
});
```

This configuration ensures that both the apex domain and the www subdomain resolve to the CloudFront distribution, which in turn serves the Next.js application running on App Runner.

By using alias records, we benefit from Route 53's ability to automatically update the DNS records if the CloudFront distribution's domain name changes, without any manual intervention.

Make sure to update your domain's name servers to use the ones provided by your Route 53 hosted zone for this configuration to take effect.
