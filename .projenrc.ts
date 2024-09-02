const { awscdk } = require('projen');
const { JobPermission } = require('projen/lib/github/workflows-model');
const { UpgradeDependenciesSchedule } = require('projen/lib/javascript');
const AUTOMATION_TOKEN = 'PROJEN_GITHUB_TOKEN';

const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.118.0',
  license: 'MIT-0',
  copyrightOwner: 'Court Schuett',
  appEntrypoint: 'next-js-app-runner-deployment.ts',
  jest: false,
  projenrcTs: true,
  depsUpgradeOptions: {
    ignoreProjen: false,
    workflowOptions: {
      labels: ['auto-approve', 'auto-merge'],
      schedule: UpgradeDependenciesSchedule.WEEKLY,
    },
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

project.addTask('launch', {
  exec: 'yarn cdk deploy --require-approval never',
});

project.tsconfigDev.file.addOverride('include', [
  'src/**/*.ts',
  './.projenrc.ts',
  'client/**/*.ts',
  'client/**/*.tsx',
]);

project.eslint.addOverride({
  files: ['src/resources/**/*.ts'],
  rules: {
    'indent': 'off',
    '@typescript-eslint/indent': 'off',
  },
});

// Add new configurations below this line

// Add a custom task to upgrade Next.js app dependencies
project.addTask('upgrade:nextjs', {
  exec: 'cd src/resources/app && yarn upgrade-interactive --latest',
});

// Add a custom task to run both CDK and Next.js upgrades
project.addTask('upgrade:all', {
  exec: 'npx projen upgrade && yarn upgrade:nextjs',
});

// Create a new GitHub workflow for weekly upgrades
const workflow = project.github?.addWorkflow('weekly-upgrade');
workflow?.on({
  schedule: [{ cron: '0 5 * * 1' }], // Run at 5:00 AM every Monday
  workflow_dispatch: {}, // Allow manual triggering
});

workflow?.addJobs({
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
      { run: 'npx projen upgrade:all' },
      {
        name: 'Create Pull Request',
        uses: 'peter-evans/create-pull-request@v6',
        with: {
          'token': '${{ secrets.GITHUB_TOKEN }}',
          'commit-message': 'chore: weekly dependency upgrade',
          'branch': 'deps/weekly-upgrade',
          'title': 'chore: weekly dependency upgrade',
          'body':
            'This PR contains the following updates:\n- CDK project dependencies upgrade\n- Next.js app dependencies upgrade',
          'labels': 'dependencies',
        },
      },
    ],
  },
});

// Update the Next.js app's package.json
const nextAppPackageJson = project.tryFindObjectFile(
  'src/resources/app/package.json',
);
if (nextAppPackageJson) {
  nextAppPackageJson.addOverride('resolutions', {
    '@types/react': '^18',
  });
}

project.github?.addWorkflow('deploy', {
  on: {
    push: {
      branches: ['main'],
    },
  },
  jobs: {
    deploy: {
      runsOn: ['ubuntu-latest'],
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
          run: 'yarn build',
          workingDirectory: 'src/resources/app',
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
  },
});

project.synth();
