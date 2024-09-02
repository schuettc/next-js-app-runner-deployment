const { awscdk } = require('projen');
const { UpgradeDependenciesSchedule } = require('projen/lib/javascript');
const { JobPermission } = require('projen/lib/github/workflows-model');
const AUTOMATION_TOKEN = 'PROJEN_GITHUB_TOKEN';

const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.118.0',
  license: 'MIT-0',
  copyrightOwner: 'Court Schuett',
  appEntrypoint: 'next-js-app-runner-deployment.ts',
  jest: false,
  projenrcTs: true,
  depsUpgradeOptions: {
    workflowOptions: {
      schedule: UpgradeDependenciesSchedule.WEEKLY,
    },
    tasks: ['upgrade:all'],
  },
  autoApproveOptions: {
    secret: 'GITHUB_TOKEN',
    allowedUsernames: ['schuettc'],
  },
  autoApproveUpgrades: true,
  projenUpgradeSecret: 'PROJEN_GITHUB_TOKEN',
  defaultReleaseBranch: 'main',
  name: 'next-js-app-runner-deployment',
  deps: ['dotenv'],
});

project.addTask('upgrade:nextjs', {
  exec: [
    'cd src/resources/app',
    'yarn upgrade --latest',
    'yarn add next@latest react@latest react-dom@latest',
    'yarn add --dev @types/react@latest @types/react-dom@latest @types/node@latest',
    'cd ../../..',
  ].join(' && '),
});

project.addTask('upgrade:all', {
  exec: 'npx projen upgrade && yarn upgrade:nextjs',
});

// Add a new workflow for upgrading the Next.js app
const upgradeNextjs = project.github?.addWorkflow('upgrade-nextjs');
upgradeNextjs?.on({
  schedule: [{ cron: '0 5 * * 1' }], // Run at 5:00 AM every Monday
  workflow_dispatch: {}, // Allow manual triggering
});

upgradeNextjs?.addJobs({
  upgrade: {
    runsOn: ['ubuntu-latest'],
    permissions: {
      contents: JobPermission.WRITE,
      pullRequests: JobPermission.WRITE,
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
        name: 'Upgrade Next.js app dependencies',
        run: 'yarn upgrade:nextjs',
      },
      {
        name: 'Check for changes',
        id: 'git-check',
        run: 'git diff --exit-code || echo "changes=true" >> $GITHUB_OUTPUT',
      },
      {
        name: 'Create Pull Request',
        if: "steps.git-check.outputs.changes == 'true'",
        uses: 'peter-evans/create-pull-request@v6',
        with: {
          'token': '${{ secrets.GITHUB_TOKEN }}',
          'commit-message': 'chore: upgrade Next.js app dependencies',
          'branch': 'deps/upgrade-nextjs',
          'title': 'chore: upgrade Next.js app dependencies',
          'body': 'This PR upgrades the dependencies for the Next.js app.',
          'labels': 'dependencies,nextjs',
        },
      },
    ],
  },
});

const nextAppPackageJson = project.tryFindObjectFile(
  'src/resources/app/package.json',
);
if (nextAppPackageJson) {
  nextAppPackageJson.addOverride('resolutions', {
    '@types/react': '^18',
  });
}

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
        name: 'Install dependencies',
        run: 'yarn install --frozen-lockfile',
      },
      {
        uses: 'aws-actions/configure-aws-credentials@v4',
        with: {
          'aws-access-key-id': '${{ secrets.AWS_ACCESS_KEY_ID }}',
          'aws-secret-access-key': '${{ secrets.AWS_SECRET_ACCESS_KEY }}',
          'aws-region': '${{ secrets.AWS_REGION }}',
        },
      },
      {
        run: 'npx cdk deploy --require-approval never',
      },
    ],
  },
});

project.synth();
