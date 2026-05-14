jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

global.requestAnimationFrame = callback => setTimeout(callback, 0);
global.cancelAnimationFrame = handle => clearTimeout(handle);
