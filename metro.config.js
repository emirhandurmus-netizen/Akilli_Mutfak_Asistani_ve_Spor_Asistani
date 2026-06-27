const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Use worker threads instead of child processes for transformer/file map workers.
// This avoids spawn-related failures in restrictive Windows environments.
config.transformer = config.transformer || {};
config.watcher = config.watcher || {};
config.transformer.unstable_workerThreads = true;
config.watcher.unstable_workerThreads = true;

module.exports = config;
