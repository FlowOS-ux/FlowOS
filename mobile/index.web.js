/**
 * FlowOS mobile - web entry (React Native Web).
 * Mounts App via react-dom createRoot (React 19) wrapped in an error boundary, and
 * loads the icon font used by Paper. On-screen error reporting (no DevTools needed).
 */
import './src/web/installErrorReporter'; // MUST be first: catches import-time errors below
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Probe } from './src/web/Probe';
import { ErrorBoundary } from './src/web/ErrorBoundary';

// TEMP: set to true to render the diagnostic probe instead of the full App.
const USE_PROBE = false;
import MaterialCommunityIconsFont from 'react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf';

// The global error/unhandledrejection handlers (incl. the network-error guard that
// keeps transient blips from blanking the app) are installed once by
// installErrorReporter.js above. `window.__flowosShowError` is its renderer.
const showError = window.__flowosShowError || (() => {});

// Register the MaterialCommunityIcons font so react-native-paper icons render on web.
const styleEl = document.createElement('style');
styleEl.appendChild(
  document.createTextNode(
    `@font-face { font-family: 'MaterialCommunityIcons'; src: url(${MaterialCommunityIconsFont}) format('truetype'); }`,
  ),
);
document.head.appendChild(styleEl);

try {
  const container = document.getElementById('root');
  const root = createRoot(container);
  const tree = USE_PROBE ? React.createElement(Probe) : React.createElement(App);
  root.render(React.createElement(ErrorBoundary, null, tree));
} catch (err) {
  showError('mount', (err && err.stack) || String(err));
}
