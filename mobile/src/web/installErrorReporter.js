/**
 * FlowOS mobile - src/web/installErrorReporter.js
 * Imported FIRST in index.web.js so its side effects run before App/provider modules
 * evaluate — this way even import-time (module-eval) crashes are shown on screen.
 */
function showError(label, detail) {
  var root = document.getElementById('root');
  if (!root) return;
  root.innerHTML =
    '<pre style="white-space:pre-wrap;word-break:break-word;color:#b91c1c;background:#fff;' +
    'padding:16px;margin:0;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;overflow:auto;height:100%">' +
    '[' +
    label +
    ']\n' +
    String(detail || '').replace(/&/g, '&amp;').replace(/</g, '&lt;') +
    '</pre>';
}

if (typeof window !== 'undefined') {
  window.__flowosShowError = showError;
  window.addEventListener('error', function (e) {
    showError('window.error', (e.error && e.error.stack) || e.message || String(e));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    showError('unhandledrejection', (r && r.stack) || (r && r.message) || String(r));
  });
}
