import { App, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppRunnerResources, CloudFrontResources } from './';

interface NextJSAppRunnerDeploymentProps extends StackProps {
  logLevel: string;
}
export class NextJSAppRunnerDeployment extends Stack {
  constructor(
    scope: Construct,
    id: string,
    _props: NextJSAppRunnerDeploymentProps,
  ) {
    super(scope, id);

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
      },
    );

    new CfnOutput(this, 'CloudfrontURL', {
      value: cloudFrontResources.distribution.domainName,
    });
  }
}

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const stackProps = {
  logLevel: process.env.LOG_LEVEL || 'INFO',
};

const app = new App();

new NextJSAppRunnerDeployment(app, 'NextJSAppRunnerDeployment', {
  ...stackProps,
  env: devEnv,
});

app.synth();
