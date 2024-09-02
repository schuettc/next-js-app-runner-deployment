const { awscdk } = require('projen');
const { JobPermission } = require('projen/lib/github/workflows-model');
const { UpgradeDependenciesSchedule } = require('projen/lib/javascript');

const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.118.0',
  defaultReleaseBranch: 'main',
  name: 'next-js-app-runner-deployment',
  projenrcTs: true,
  appEntrypoint: 'next-js-app-runner-deployment.ts',

  // Dependency upgrade configuration
  depsUpgradeOptions: {
    workflowOptions: {
      schedule: UpgradeDependenciesSchedule.WEEKLY,
    },
    tasks: ['upgrade:all'],
  },

  // GitHub Actions configuration
  github: true,
  githubOptions: {
    pullRequestLint: false,
  },

  // Other project configurations
  deps: ['dotenv'],
  devDeps: [
    'eslint-plugin-react',
    '@typescript-eslint/eslint-plugin',
    'eslint-plugin-react-hooks',
    '@next/eslint-plugin-next',
  ],
});

// Add custom tasks
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

// Configure ESLint for Next.js
const eslint = project.eslint;
if (eslint) {
  eslint.addOverride({
    files: ['src/resources/app/src/**/*.ts', 'src/resources/app/src/**/*.tsx'],
    extends: [
      'plugin:react/recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:@next/next/recommended',
    ],
    plugins: ['react', '@typescript-eslint'],
    settings: {
      react: {
        version: 'detect',
      },
    },
  });
}

// Add deployment workflow
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

// Synthesize the project
project.synth();
