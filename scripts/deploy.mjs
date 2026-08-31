import { spawnSync } from 'node:child_process';

const projectName = 'ddochiseom-frontend';

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const args = process.argv.slice(2);
let branch = '';
let skipBuild = false;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];

  if (arg === '--branch') {
    branch = args[index + 1] ?? '';
    if (!branch) {
      console.error('[deploy] missing value for --branch');
      process.exit(1);
    }
    index += 1;
    continue;
  }

  if (arg === '--skip-build') {
    skipBuild = true;
    continue;
  }

  console.error(`[deploy] unknown flag: ${arg}`);
  process.exit(1);
}

if (!skipBuild) {
  console.log('[deploy] building SPA');
  run('npm', ['run', 'build']);
}

// commit message 명시 전달 — Windows PowerShell 의 cp949 encoding 으로 인해
// wrangler 가 git log 자동 감지 시 invalid UTF-8 으로 거부되는 이슈 회피.
// 추가: shell:true 의 공백 split 이슈 회피 위해 single token (underscore).
let commitMessage = 'deploy';
try {
  const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout) commitMessage = `deploy_${r.stdout.trim()}`;
} catch (_) { /* fallback to plain 'deploy' */ }

const deployArgs = [
  'wrangler',
  'pages',
  'deploy',
  'dist',
  '--project-name',
  projectName,
  '--commit-dirty=true',
  '--commit-message',
  commitMessage,
];

if (branch) {
  deployArgs.push('--branch', branch);
}

console.log('[deploy] uploading to Cloudflare Pages');
run('npx', deployArgs);

console.log('[deploy] done.');