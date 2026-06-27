const fs = require('fs');
const path = require('path');

function stripWrappingQuotes(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const result = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    if (!key) {
      continue;
    }

    result[key] = stripWrappingQuotes(line.slice(equalsIndex + 1).trim());
  }

  return result;
}

module.exports = () => {
  const root = __dirname;
  const appJson = require('./app.json');
  const visibleEnv = loadEnvFile(path.join(root, 'env.local'));
  const hiddenEnv = loadEnvFile(path.join(root, '.env.local'));
  const sharedEnv = {
    ...hiddenEnv,
    ...visibleEnv,
  };

  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      extra: {
        ...(appJson.expo.extra || {}),
        ...sharedEnv,
      },
    },
  };
};
