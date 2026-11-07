// Shows startup problems on the title screen instead of failing silently.
function showError(msg) {
  var t = document.getElementById('ovTitle'), p = document.getElementById('ovText'), b = document.getElementById('ovBtn');
  t.textContent = 'Something went wrong';
  p.textContent = msg;
  b.textContent = 'Reload';
  b.onclick = function () { location.reload(); };
}
window.addEventListener('error', function (e) {
  if (!window.__gameReady) showError((e.message || 'Script error') + (e.filename ? ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')' : ''));
});
window.addEventListener('unhandledrejection', function (e) {
  if (!window.__gameReady) showError(String(e.reason && e.reason.message || e.reason));
});
setTimeout(function () {
  if (!window.__gameReady) showError("The game engine (three.js) didn't load. Check your internet connection, then reload.");
}, 10000);
