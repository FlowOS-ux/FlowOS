/**
 * FlowOS mobile - src/web/installErrorReporter.js
 * Imported FIRST in index.web.js so its side effects run before App/provider modules
 * evaluate — this way even import-time (module-eval) crashes are shown on screen.
 *
 * IMPORTANT: this must only surface GENUINE fatal errors (failed imports, render
 * crashes). A transient network/axios rejection must NOT blank the whole app —
 * doing so was a cause of the full-screen "Network Error" that only a manual
 * refresh cleared. Such rejections are handled gracefully by the API client, so
 * here we log and ignore them.
 */
function isNetworkLike(reason) {
  if (!reason) return false;
  // Axios marks its errors with isAxiosError; network/timeout/cancel also carry codes.
  if (reason.isAxiosError) return true;
  var code = reason.code;
  if (code === 'ERR_NETWORK' || code === 'ECONNABORTED' || code === 'ERR_CANCELED') return true;
  var msg = String((reason && reason.message) || reason || '');
  return /Network Error|timeout of|ECONNREFUSED|ERR_NETWORK|Failed to fetch/i.test(msg);
}

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
  window.__flowosIsNetworkLike = isNetworkLike;
  window.addEventListener('error', function (e) {
    if (isNetworkLike(e.error || e)) return; // don't nuke the app for a network blip
    showError('window.error', (e.error && e.error.stack) || e.message || String(e));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    if (isNetworkLike(r)) {
      // Handled by the API client's retry/recovery — keep the app on screen.
      // eslint-disable-next-line no-console
      if (typeof console !== 'undefined') console.warn('Ignored network-related rejection:', r);
      return;
    }
    showError('unhandledrejection', (r && r.stack) || (r && r.message) || String(r));
  });
}
