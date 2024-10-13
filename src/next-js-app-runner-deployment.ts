import { App, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import { AppRunnerResources, CloudFrontResources, Route53Resources } from './';

config();

interface NextJSAppRunnerDeploymentProps extends StackProps {
  logLevel: string;
  domainName: string;
  hostedZoneId: string;
}

export class NextJSAppRunnerDeployment extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: NextJSAppRunnerDeploymentProps,
  ) {
    super(scope, id, props);

    // Create AppRunner resources first
    const appRunnerResources = new AppRunnerResources(
      this,
      'AppRunnerResources',
    );

    // Create CloudFront resources using the AppRunner service URL
    const cloudFrontResources = new CloudFrontResources(
      this,
      'CloudFrontResources',
      {
        appRunnerServiceUrl: appRunnerResources.service.attrServiceUrl,
        domainName: props.domainName,
        hostedZoneId: props.hostedZoneId,
      },
    );

    // Create Route 53 resources
    new Route53Resources(this, 'Route53Resources', {
      domainName: props.domainName,
      hostedZoneId: props.hostedZoneId,
      distribution: cloudFrontResources.distribution,
    });

    new CfnOutput(this, 'CloudfrontURL', {
      value: cloudFrontResources.distribution.domainName,
    });

    new CfnOutput(this, 'WebsiteURL', {
      value: `https://${props.domainName}`,
    });
  }
}

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const stackProps = {
  logLevel: process.env.LOG_LEVEL || 'INFO',
  domainName: process.env.DOMAIN_NAME || '',
  hostedZoneId: process.env.HOSTED_ZONE_ID || '',
};

if (!stackProps.domainName || !stackProps.hostedZoneId) {
  throw new Error(
    'DOMAIN_NAME and HOSTED_ZONE_ID must be provided in the .env file',
  );
}

const app = new App();

new NextJSAppRunnerDeployment(app, 'NextJSAppRunnerDeployment', {
  ...stackProps,
  env: devEnv,
});

app.synth();
