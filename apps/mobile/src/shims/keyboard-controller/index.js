const React = require('react');
const { KeyboardAvoidingView } = require('react-native');

// Minimal KeyboardProvider shim used by react-native-gifted-chat
function KeyboardProvider({ children }) {
  return React.createElement(React.Fragment, null, children);
}

module.exports = {
  KeyboardAvoidingView,
  KeyboardProvider,
};
