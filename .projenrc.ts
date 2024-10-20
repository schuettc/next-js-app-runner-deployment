const { awscdk } = require("projen");
const { JobPermission } = require("projen/lib/github/workflows-model");
const { IgnoreFile } = require("projen/lib/ignore-file");
const { UpgradeDependenciesSchedule } = require("projen/lib/javascript");
const { NodePackageManager } = require("projen/lib/javascript");

const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: "2.118.0",
  defaultReleaseBranch: "main",
  name: "next-js-app-runner-deployment",
  projenrcTs: true,
  appEntrypoint: "next-js-app-runner-deployment.ts",
  packageManager: NodePackageManager.YARN, // Use Yarn as the package manager
  depsUpgrade: false,
  deps: ["dotenv", "next", "react", "react-dom"],
  devDeps: [
    "eslint-plugin-react",
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/parser",
    "eslint-plugin-react-hooks",
    "@next/eslint-plugin-next",
    "eslint-plugin-import",
    "eslint-import-resolver-typescript",
    "@types/aws-lambda",
    "@types/react",
    "@types/react-dom",
    "@types/node",
  ],
  jest: false, // Add this line to disable Jest
  eslint: true,
  eslintOptions: {
    dirs: ["src"],
    devdirs: ["test", "projenrc"],
    filePath: ".eslintrc.json",
    prettier: true,
    tsConfigPath: "tsconfig.dev.json",
  },
  tsconfig: {
    include: [
      "src/**/*.ts",
      ".projenrc.ts",
      "src/resources/app/src/**/*.ts",
      "src/resources/app/src/**/*.tsx",
    ],
  },
});

// Configure ESLint
const eslint = project.eslint;
if (eslint) {
  eslint.addOverride({
    files: [
      "src/resources/app/src/**/*.ts",
      "src/resources/app/src/**/*.tsx",
      "src/**/*.ts",
    ],
    extends: [
      "plugin:react/recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:@next/next/recommended",
    ],
    plugins: ["react", "@typescript-eslint", "import"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
      ecmaFeatures: { jsx: true },
      ecmaVersion: 2018,
      sourceType: "module",
    },
    rules: {
      "import/no-unresolved": "error",
      "import/no-extraneous-dependencies": "off", // Disable this rule for Next.js files
      "@typescript-eslint/indent": ["error", 2],
      "@typescript-eslint/member-delimiter-style": [
        "error",
        {
          multiline: {
            delimiter: "semi",
            requireLast: true,
          },
          singleline: {
            delimiter: "semi",
            requireLast: false,
          },
        },
      ],
      "@next/next/no-html-link-for-pages": [
        "error",
        "src/resources/app/src/app",
      ],
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
    settings: {
      react: { version: "detect" },
    },
  });
}

// Update the root .gitignore
const gitignore = project.gitignore;
gitignore.addPatterns(
  ".next",
  "out",
  "dist",
  "build",
  "*.tsbuildinfo",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  ".vscode/",
  ".idea/",
  ".DS_Store",
  "Thumbs.db",
  ".env*.local",
  ".vercel",
);

const nextAppGitignore = new IgnoreFile(
  project,
  "src/resources/app/.gitignore",
);
nextAppGitignore.addPatterns(
  "/.next/",
  "/out/",
  "/build",
  ".DS_Store",
  "*.pem",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  ".env*.local",
  ".vercel",
  "*.tsbuildinfo",
  "next-env.d.ts",
);

project.addTask("upgrade:nextjs", {
  exec: ["cd src/resources/app", "yarn upgrade --latest", "cd ../../.."].join(
    " && ",
  ),
});

project.addTask("upgrade:all", {
  description:
    "Upgrade dependencies for both the main project and the Next.js app",
  steps: [{ spawn: "upgrade:projen" }, { spawn: "upgrade:nextjs" }],
});

const deploy = project.github?.addWorkflow("deploy");
deploy?.on({
  push: {
    branches: ["main"],
  },
  workflow_dispatch: {},
});

deploy?.addJobs({
  deploy: {
    runsOn: ["ubuntu-latest"],
    permissions: {
      contents: JobPermission.READ,
      id_token: JobPermission.WRITE,
    },
    steps: [
      { uses: "actions/checkout@v4" },
      {
        uses: "actions/setup-node@v4",
        with: {
          "node-version": "18",
        },
      },
      { run: "yarn install --frozen-lockfile" },
      {
        uses: "aws-actions/configure-aws-credentials@v4",
        with: {
          "aws-access-key-id": "${{ secrets.AWS_ACCESS_KEY_ID }}",
          "aws-secret-access-key": "${{ secrets.AWS_SECRET_ACCESS_KEY }}",
          "aws-region": "${{ secrets.AWS_REGION }}",
        },
      },
      { run: "npx cdk deploy --require-approval never" },
    ],
  },
});

const upgradeWorkflow = project.github?.addWorkflow("upgrade");
upgradeWorkflow?.on({
  schedule: [{ cron: "0 0 * * 1" }],
  workflow_dispatch: {},
});

upgradeWorkflow?.addJobs({
  upgrade: {
    runsOn: ["ubuntu-latest"],
    permissions: {
      contents: JobPermission.WRITE,
      pullRequests: JobPermission.WRITE,
    },
    steps: [
      { uses: "actions/checkout@v4" },
      { uses: "actions/setup-node@v4", with: { "node-version": "18" } },
      { run: "yarn install" },
      { run: "npx projen upgrade:projen" },
      { run: "npx projen upgrade:nextjs" },
      {
        name: "Create Pull Request",
        uses: "peter-evans/create-pull-request@v6",
        with: {
          token: "${{ secrets.PROJEN_GITHUB_TOKEN }}",
          "commit-message": "chore: upgrade dependencies",
          branch: "projen-upgrade",
          title: "chore: upgrade dependencies",
          body: "This PR upgrades project dependencies, including projen and Next.js. Auto-generated by projen upgrade workflow.",
        },
      },
    ],
  },
});

project.addTask("install:nextjs", {
  cwd: "src/resources/app",
  exec: "yarn install",
});

project.addTask("build:nextjs", {
  cwd: "src/resources/app",
  exec: "yarn build",
});

project.addTask("build:all", {
  description: "Build both the main project and the Next.js app",
  steps: [
    { spawn: "build" },
    { spawn: "install:nextjs" },
    { spawn: "eslint:nextjs" },
    { spawn: "build:nextjs" },
  ],
});

project.addTask("eslint:nextjs", {
  cwd: "src/resources/app",
  exec: "eslint . --ext .ts,.tsx",
});

project.addTask("upgrade:projen", {
  description: "Upgrade projen dependencies",
  steps: [
    { exec: "yarn upgrade projen @projen/awscdk-app-ts" },
    { exec: "npx projen" },
  ],
});

project.synth();
