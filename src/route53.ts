import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { HostedZone, RecordTarget, ARecord } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

interface Route53ResourcesProps {
  domainName: string;
  hostedZoneId: string;
  distribution: Distribution;
}

export class Route53Resources extends Construct {
  constructor(scope: Construct, id: string, props: Route53ResourcesProps) {
    super(scope, id);

    const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      zoneName: props.domainName,
      hostedZoneId: props.hostedZoneId,
    });

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
  }
}
