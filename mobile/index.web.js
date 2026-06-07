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

function showError(label, detail) {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML =
    '<pre style="white-space:pre-wrap;word-break:break-word;color:#b91c1c;background:#fff;' +
    'padding:16px;margin:0;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;overflow:auto;height:100%">' +
    '[' + label + ']\n' +
    String(detail || '').replace(/&/g, '&amp;').replace(/</g, '&lt;') +
    '</pre>';
}
window.addEventListener('error', (e) => showError('window.error', (e.error && e.error.stack) || e.message));
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  showError('unhandledrejection', (r && r.stack) || (r && r.message) || String(r));
});

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
