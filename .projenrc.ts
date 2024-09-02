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
      schedule: UpgradeDependenciesSchedule.WEEKLY,
    },
    tasks: ['upgrade:all'],
  },
  // If you want to use a specific token for creating PRs:
  // depsUpgradeOptions: {
  //   workflowOptions: {
  //     schedule: UpgradeDependenciesSchedule.WEEKLY,
  //     projenCredentials: {
  //       github: { appId: 1, privateKey: 'PROJEN_GITHUB_TOKEN' },
  //     },
  //   },
  // },
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

// Add a custom task to upgrade Next.js app dependencies
project.addTask('upgrade:nextjs', {
  exec: 'cd src/resources/app && yarn upgrade --latest',
});

// Add a new task that runs both the default upgrade and the Next.js upgrade
project.addTask('upgrade:all', {
  exec: 'npx projen upgrade && yarn upgrade:nextjs',
});

const nextAppPackageJson = project.tryFindObjectFile(
  'src/resources/app/package.json',
);
if (nextAppPackageJson) {
  nextAppPackageJson.addOverride('resolutions', {
    '@types/react': '^18',
  });
}

// const workflow = project.github?.addWorkflow('weekly-upgrade');
// workflow?.on({
//   schedule: [{ cron: '0 5 * * 1' }], // Run at 5:00 AM every Monday
//   workflow_dispatch: {}, // Allow manual triggering
// });

// workflow?.addJobs({
//   upgrade: {
//     runsOn: ['ubuntu-latest'],
//     permissions: {
//       contents: JobPermission.WRITE,
//       pullRequests: JobPermission.WRITE,
//     },
//     steps: [
//       { uses: 'actions/checkout@v4' },
//       {
//         uses: 'actions/setup-node@v4',
//         with: {
//           'node-version': '18',
//         },
//       },
//       { run: 'yarn install --frozen-lockfile' },
//       {
//         name: 'Upgrade CDK project dependencies',
//         run: 'npx projen upgrade',
//         continueOnError: true,
//       },
//       {
//         name: 'Upgrade Next.js app dependencies',
//         run: 'yarn upgrade:nextjs',
//         continueOnError: true,
//       },
//       {
//         name: 'Check for changes',
//         id: 'git-check',
//         run: 'git diff --exit-code || echo "changes=true" >> $GITHUB_OUTPUT',
//       },
//       {
//         name: 'Create Pull Request',
//         if: "steps.git-check.outputs.changes == 'true'",
//         uses: 'peter-evans/create-pull-request@v6',
//         with: {
//           'token': '${{ secrets.GITHUB_TOKEN }}',
//           'commit-message': 'chore: weekly dependency upgrade',
//           'branch': 'deps/weekly-upgrade',
//           'title': 'chore: weekly dependency upgrade',
//           'body':
//             'This PR contains the following updates:\n- CDK project dependencies upgrade\n- Next.js app dependencies upgrade',
//           'labels': 'dependencies',
//         },
//       },
//     ],
//   },
// });

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
