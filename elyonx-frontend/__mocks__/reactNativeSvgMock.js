const React = require('react');
const { View } = require('react-native');

const SvgMock = ({ children, ...props }) =>
  React.createElement(View, props, children);

module.exports = new Proxy(SvgMock, {
  get: (target, prop) => {
    if (prop === 'default') {
      return target;
    }
    return target;
  },
});
