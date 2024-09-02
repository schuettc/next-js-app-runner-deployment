import {
  Distribution,
  ViewerProtocolPolicy,
  OriginRequestPolicy,
  CachePolicy,
  OriginProtocolPolicy,
  HttpVersion,
  OriginRequestHeaderBehavior,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

interface CloudFrontResourcesProps {
  appRunnerServiceUrl: string;
}

export class CloudFrontResources extends Construct {
  public readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: CloudFrontResourcesProps) {
    super(scope, id);

    const appRunnerOrigin = new HttpOrigin(props.appRunnerServiceUrl, {
      protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
      httpPort: 80,
      httpsPort: 443,
    });

    // Create a custom origin request policy
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

    this.distribution = new Distribution(this, 'CloudFrontDistribution', {
      defaultBehavior: {
        origin: appRunnerOrigin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        originRequestPolicy: customOriginRequestPolicy,
        cachePolicy: CachePolicy.CACHING_DISABLED,
      },
      httpVersion: HttpVersion.HTTP2,
    });
  }
}
