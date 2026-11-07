// Shows startup problems on the main menu instead of failing silently.
(function () {
  var shown = false;
  function showError(msg) {
    if (window.__gameReady || shown) return;
    shown = true;
    var box = document.getElementById('menuError');
    if (!box) return;
    box.hidden = false;
    box.textContent = 'Something went wrong: ' + msg + ' ';
    var b = document.createElement('button');
    b.className = 'btn'; b.textContent = 'Reload';
    b.onclick = function () { location.reload(); };
    box.appendChild(b);
    var menu = document.querySelector('[data-screen="main"] .menu');
    if (menu) menu.hidden = true;
  }
  window.addEventListener('error', function (e) {
    showError((e.message || 'Script error') + (e.filename ? ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')' : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    showError(String((e.reason && e.reason.message) || e.reason));
  });
  setTimeout(function () {
    showError("the game engine (three.js) didn't load. Check your internet connection, then reload.");
  }, 10000);
})();
