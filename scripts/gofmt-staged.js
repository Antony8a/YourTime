// Formats staged Go files for lint-staged. Uses the local gofmt if there is one; on
// a computer without Go (like this Windows machine) it runs gofmt in the golang image
// instead; and if neither is available it says so and lets the commit go on, since CI
// checks `gofmt -l` anyway.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = process.cwd();
const files = process.argv.slice(2).map((f) => path.relative(root, f).split(path.sep).join('/'));
if (files.length === 0) process.exit(0);

const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit', cwd: root });

let result = run('gofmt', ['-w', '-s', ...files]);
if (result.error && result.error.code === 'ENOENT') {
  const docker = spawnSync('docker', ['info'], { stdio: 'ignore' });
  if (docker.status === 0) {
    result = run('docker', [
      'run',
      '--rm',
      '-v',
      `${root}:/src`,
      '-w',
      '/src',
      'golang:1.23',
      'gofmt',
      '-w',
      '-s',
      ...files,
    ]);
  } else {
    console.warn(
      'gofmt-staged: no gofmt and Docker is off; skipping Go formatting (CI will check it).'
    );
    process.exit(0);
  }
}
process.exit(result.status ?? 1);
