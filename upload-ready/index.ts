import { registerRootComponent } from 'expo';

import App from './App';

if (typeof window !== 'undefined') {
  const noisyPrefixes = [
    'Download the React DevTools for a better development experience',
    'Running application "main" with appParams:',
    'Development-level warnings:',
    'Performance optimizations:',
  ];

  const wrapConsoleMethod = (method: 'info' | 'log') => {
    const original = console[method].bind(console);

    console[method] = (...args: any[]) => {
      const firstArg = args[0];
      if (typeof firstArg === 'string' && noisyPrefixes.some((prefix) => firstArg.startsWith(prefix))) {
        return;
      }
      original(...args);
    };
  };

  wrapConsoleMethod('info');
  wrapConsoleMethod('log');
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
