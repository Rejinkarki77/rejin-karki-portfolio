(function () {
  'use strict';

  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var total = slides.length;
  var deck = document.getElementById('deck');
  var dots = document.getElementById('dots');
  var prev = document.getElementById('prev');
  var next = document.getElementById('next');
  var counter = document.getElementById('counter');
  var live = document.getElementById('live');
  var cur = 0;

  /* theme toggle */
  var root = document.documentElement;
  var toggle = document.getElementById('themeToggle');
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function syncToggle() { toggle.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme'); }
  toggle.addEventListener('click', function () {
    var n = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', n);
    try { localStorage.setItem('theme', n); } catch (e) {}
    syncToggle();
  });
  syncToggle();
  document.getElementById('printBtn').addEventListener('click', function () { window.print(); });

  /* dots */
  slides.forEach(function (s, i) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Go to slide ' + (i + 1) + ': ' + s.getAttribute('data-title'));
    b.addEventListener('click', function () { go(i); });
    li.appendChild(b);
    dots.appendChild(li);
    s.setAttribute('role', 'group');
    s.setAttribute('aria-label', 'Slide ' + (i + 1) + ' of ' + total + ': ' + s.getAttribute('data-title'));
  });

  function render(announce) {
    slides.forEach(function (s, i) {
      var d = i - cur;
      var pos = d === 0 ? 'active' : d < 0 ? 'prev' : d <= 3 ? 'next' : 'far';
      s.setAttribute('data-pos', pos);
      s.style.setProperty('--d', Math.max(d, 0));
      if (d === 0) { s.removeAttribute('inert'); s.removeAttribute('aria-hidden'); }
      else { s.setAttribute('inert', ''); s.setAttribute('aria-hidden', 'true'); }
    });
    Array.prototype.forEach.call(dots.querySelectorAll('button'), function (b, i) {
      if (i === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    prev.disabled = cur === 0;
    next.disabled = cur === total - 1;
    counter.textContent = (cur + 1) + ' of ' + total;
    slides[cur].querySelector('.inner').scrollTop = 0;
    if (announce) live.textContent = 'Slide ' + (cur + 1) + ' of ' + total + ': ' + slides[cur].getAttribute('data-title');
    try { history.replaceState(null, '', '#' + (cur + 1)); } catch (e) {}
  }

  function go(i) {
    var n = Math.max(0, Math.min(total - 1, i));
    if (n === cur) return;
    cur = n;
    render(true);
  }

  prev.addEventListener('click', function () { go(cur - 1); });
  next.addEventListener('click', function () { go(cur + 1); });

  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(cur + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(cur - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(total - 1); }
  });

  /* swipe */
  var sx = null, sy = null;
  deck.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; } });
  deck.addEventListener('pointerup', function (e) {
    if (sx === null) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    sx = sy = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1));
  });

  /* mouse tilt on the front slide */
  var canTilt = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
                !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (canTilt) {
    var frame = null;
    var stage = document.getElementById('stage');
    stage.addEventListener('pointermove', function (e) {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        var s = slides[cur];
        var r = deck.getBoundingClientRect();
        var px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        var py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
        s.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg');
        s.style.setProperty('--rx', ((0.5 - py) * 7).toFixed(2) + 'deg');
        s.style.setProperty('--gx', (e.clientX - r.left) + 'px');
        s.style.setProperty('--gy', (e.clientY - r.top) + 'px');
        s.classList.add('is-tilting');
      });
    });
    stage.addEventListener('pointerleave', function () {
      if (frame) cancelAnimationFrame(frame);
      slides.forEach(function (s) {
        s.style.setProperty('--rx', '0deg');
        s.style.setProperty('--ry', '0deg');
        s.classList.remove('is-tilting');
      });
    });
  }

  var start = parseInt((location.hash || '').slice(1), 10);
  if (start >= 1 && start <= total) cur = start - 1;
  render(false);
})();
