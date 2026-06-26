const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const silent = process.argv.includes('--silent');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(
    path.join(root, relativePath),
    `${JSON.stringify(value, null, 2)}\n`
  );
}

function bumpPatch(version) {
  const match = String(version || '0.0.0').match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

const packageJson = readJson('package.json');
const nextVersion = bumpPatch(packageJson.version);
packageJson.version = nextVersion;
writeJson('package.json', packageJson);

const appJson = readJson('app.json');
appJson.expo = appJson.expo || {};
appJson.expo.version = nextVersion;
writeJson('app.json', appJson);

const lockPath = path.join(root, 'package-lock.json');
if (fs.existsSync(lockPath)) {
  const packageLock = readJson('package-lock.json');
  packageLock.version = nextVersion;
  if (packageLock.packages?.['']) {
    packageLock.packages[''].version = nextVersion;
  }
  writeJson('package-lock.json', packageLock);
}

if (!silent) {
  console.log(`Version bumped to v${nextVersion}`);
}
