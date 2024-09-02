import * as path from 'path';
import { CfnService } from 'aws-cdk-lib/aws-apprunner';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { Role, ServicePrincipal, ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class AppRunnerResources extends Construct {
  public readonly service: CfnService;
  public readonly instanceRole: Role;
  private readonly accessRole: Role;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.instanceRole = new Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new ServicePrincipal('tasks.apprunner.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSAppRunnerServicePolicyForECRAccess',
        ),
      ],
    });

    this.accessRole = new Role(this, 'AppRunnerAccessRole', {
      assumedBy: new ServicePrincipal('build.apprunner.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSAppRunnerServicePolicyForECRAccess',
        ),
      ],
    });

    const dockerImageAsset = new DockerImageAsset(this, 'NextJSDockerImage', {
      directory: path.join(__dirname, 'resources', 'app'),
      platform: Platform.LINUX_AMD64,
    });

    this.service = new CfnService(this, 'AppRunnerService', {
      sourceConfiguration: {
        autoDeploymentsEnabled: false,
        authenticationConfiguration: {
          accessRoleArn: this.accessRole.roleArn,
        },
        imageRepository: {
          imageIdentifier: dockerImageAsset.imageUri,
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '3000',
          },
        },
      },
      instanceConfiguration: {
        cpu: '1 vCPU',
        memory: '2 GB',
        instanceRoleArn: this.instanceRole.roleArn,
      },
      healthCheckConfiguration: {
        path: '/',
        protocol: 'HTTP',
      },
    });
  }
}
