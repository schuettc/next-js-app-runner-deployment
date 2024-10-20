import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import {
  Distribution,
  ViewerProtocolPolicy,
  OriginRequestPolicy,
  CachePolicy,
  OriginProtocolPolicy,
  HttpVersion,
  OriginRequestHeaderBehavior,
  LambdaEdgeEventType,
  OriginRequestQueryStringBehavior,
  AllowedMethods,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { LambdaEdgeFunction } from "./lambda";

interface CloudFrontResourcesProps {
  appRunnerServiceUrl: string;
  domainName: string;
  hostedZoneId: string;
}

export class CloudFrontResources extends Construct {
  public readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: CloudFrontResourcesProps) {
    super(scope, id);

    const hostedZone = HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      zoneName: props.domainName,
      hostedZoneId: props.hostedZoneId,
    });

    // Create an ACM certificate
    const certificate = new Certificate(this, "Certificate", {
      domainName: `*.${props.domainName}`,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const appRunnerOrigin = new HttpOrigin(props.appRunnerServiceUrl, {
      protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
      httpPort: 80,
      httpsPort: 443,
    });

    // Create a custom origin request policy
    const customOriginRequestPolicy = new OriginRequestPolicy(
      this,
      "UserAgentRefererHeadersPolicy",
      {
        headerBehavior: OriginRequestHeaderBehavior.allowList(
          "User-Agent",
          "Referer",
        ),
        queryStringBehavior: OriginRequestQueryStringBehavior.all(),
      },
    );

    const lambdaEdgeFunction = new LambdaEdgeFunction(
      this,
      "LambdaEdgeFunction",
    );

    const version = lambdaEdgeFunction.function.currentVersion;
    version.addPermission("InvokeLambdaPermission", {
      principal: new ServicePrincipal("edgelambda.amazonaws.com"),
      action: "lambda:InvokeFunction",
    });

    this.distribution = new Distribution(this, "CloudFrontDistribution", {
      defaultBehavior: {
        origin: appRunnerOrigin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        originRequestPolicy: customOriginRequestPolicy,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        allowedMethods: AllowedMethods.ALLOW_ALL,
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
      domainNames: [props.domainName, `www.${props.domainName}`],
      certificate: certificate,
      httpVersion: HttpVersion.HTTP2,
    });
  }
}
