(function () {
  'use strict';

  /* ───────── Theme toggle ───────── */
  var root = document.documentElement;
  var toggle = document.getElementById('themeToggle');
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function syncToggle() {
    toggle.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
  }
  toggle.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncToggle();
  });
  syncToggle();

  /* ───────── Active section in nav ───────── */
  var links = Array.prototype.slice.call(document.querySelectorAll('#navLinks a'));
  var map = {};
  links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        var a = map[en.target.id];
        if (a) a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ───────── Link checker ───────── */
  var form = document.getElementById('checkerForm');
  var input = document.getElementById('urlInput');
  var verdict = document.getElementById('verdict');
  var checksEl = document.getElementById('checks');
  var passedEl = document.getElementById('passed');
  var passedList = document.getElementById('passedList');
  var passedSummary = document.getElementById('passedSummary');

  var SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly'];
  var KEYWORDS = /(login|log-in|signin|sign-in|verify|secure|account|update|password|banking|wallet|confirm)/i;

  function analyse(raw) {
    var s = raw.trim();
    if (!s) return { error: 'Enter a web address to check, for example https://example.com.' };
    var hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
    var u;
    try { u = new URL(hasScheme ? s : 'https://' + s); } catch (e) { u = null; }
    if (!u || !/^https?:$/.test(u.protocol)) return { error: 'That does not look like a web address. Try something like https://example.com.' };
    var host = u.hostname.toLowerCase();
    var isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    var isIPv6 = host.charAt(0) === '[';
    if (!isIPv4 && !isIPv6 && host.indexOf('.') === -1) return { error: 'That address has no domain name. Try something like https://example.com.' };

    var labels = host.split('.');
    var full = u.href;
    var checks = [
      { label: 'Uses HTTPS', w: 2, bad: u.protocol === 'http:',
        why: 'The connection is not encrypted. Real login pages almost always use HTTPS.',
        ok: hasScheme ? 'The connection is encrypted.' : 'No scheme was given, so HTTPS is assumed.' },
      { label: 'Uses a domain name, not an IP address', w: 3, bad: isIPv4 || isIPv6,
        why: 'Legitimate services rarely send people to a bare IP address.', ok: 'The link uses a normal domain name.' },
      { label: 'No @ symbol in the address', w: 3, bad: /@/.test(s),
        why: 'Text before an @ is ignored by the browser and can disguise the real destination.', ok: 'No hidden destination.' },
      { label: 'Not an encoded lookalike domain', w: 2, bad: host.indexOf('xn--') !== -1,
        why: 'Punycode can make a domain look like a trusted brand using similar characters.', ok: 'No encoded characters in the domain.' },
      { label: 'Reasonable number of subdomains', w: 2, bad: !isIPv4 && labels.length >= 5,
        why: 'Long chains of subdomains can bury the real domain at the end.', ok: 'The domain structure is simple.' },
      { label: 'Few hyphens in the domain', w: 1, bad: (host.match(/-/g) || []).length >= 2,
        why: 'Several hyphens are common in made-up domains such as brand-secure-login.', ok: 'Nothing unusual in the domain.' },
      { label: 'No pressure words in the address', w: 2, bad: KEYWORDS.test(host + u.pathname),
        why: 'Words like login, verify or update often appear in phishing links.', ok: 'No urgent or account-related wording.' },
      { label: 'Not a link shortener', w: 2, bad: SHORTENERS.indexOf(host) !== -1,
        why: 'Shorteners hide where the link really goes.', ok: 'The destination is visible.' },
      { label: 'Normal length', w: 1, bad: full.length > 75,
        why: 'Very long links can hide suspicious parts.', ok: 'The link is a sensible length.' },
      { label: 'Standard port', w: 1, bad: u.port !== '' && u.port !== '80' && u.port !== '443',
        why: 'Unusual ports are rare on ordinary public websites.', ok: 'No unusual port.' }
    ];
    var score = checks.reduce(function (n, c) { return n + (c.bad ? c.w : 0); }, 0);
    var level = score >= 4 ? 'high' : score >= 2 ? 'mid' : 'low';
    return { checks: checks, score: score, level: level };
  }

  var TEXT = {
    high: ['Likely suspicious', 'Several warning signs. Do not enter a password or personal details on this page.'],
    mid:  ['Worth a second look', 'One or two warning signs. Check where the link came from before you trust it.'],
    low:  ['Nothing obvious found', 'No common warning signs, but check the sender and the spelling of the domain anyway.']
  };

  function row(c) {
    var li = document.createElement('li');
    var flag = document.createElement('span');
    flag.className = 'check-flag';
    flag.setAttribute('data-state', c.bad ? 'flagged' : 'clear');
    flag.textContent = c.bad ? 'Flagged' : 'Clear';
    var body = document.createElement('span');
    body.className = 'check-label';
    body.textContent = c.label;
    var detail = document.createElement('span');
    detail.className = 'check-detail';
    detail.textContent = c.bad ? c.why : c.ok;
    body.appendChild(detail);
    li.appendChild(flag);
    li.appendChild(body);
    return li;
  }

  function render(res) {
    checksEl.innerHTML = '';
    passedList.innerHTML = '';
    passedEl.hidden = true;
    passedEl.open = false;
    if (res.error) {
      verdict.setAttribute('data-level', 'error');
      verdict.children[0].textContent = 'Check the address';
      verdict.children[1].textContent = res.error;
      return;
    }
    verdict.setAttribute('data-level', res.level);
    verdict.children[0].textContent = TEXT[res.level][0];
    verdict.children[1].textContent = TEXT[res.level][1];
    var passed = 0;
    res.checks.forEach(function (c) {
      if (c.bad) { checksEl.appendChild(row(c)); } else { passedList.appendChild(row(c)); passed++; }
    });
    if (passed) {
      passedEl.hidden = false;
      passedSummary.textContent = 'Show the ' + passed + ' check' + (passed === 1 ? '' : 's') + ' that passed';
    }
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); render(analyse(input.value)); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-sample]'), function (b) {
    b.addEventListener('click', function () {
      input.value = b.getAttribute('data-sample');
      render(analyse(input.value));
    });
  });
  render(analyse(input.value));

  /* ───────── Toast + copy email ───────── */
  var toast = document.getElementById('toast');
  var toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 2200);
  }
  document.getElementById('copyEmail').addEventListener('click', function () {
    var email = 'rejinkarki28@gmail.com';
    function fallback() {
      var t = document.createElement('textarea');
      t.value = email; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(t);
      showToast(ok ? 'Email address copied' : 'Copy failed. Select the address and copy it.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(email).then(function () { showToast('Email address copied'); }, fallback);
    } else { fallback(); }
  });

  /* ───────── Certificate viewer ───────── */
  var CERTS = {
    'ethical-hacking': {
      title: 'Cyber Security and Ethical Hacking v2026 (Udemy)',
      img: 'assets/certs/ethical-hacking.jpg',
      verify: 'https://ude.my/UC-30f0172a-863b-44e9-ba84-fa23fdfc7bb0'
    },
    'network-hacking': {
      title: 'Learn Network Hacking From Scratch (Udemy)',
      img: 'assets/certs/network-hacking.jpg',
      verify: 'https://ude.my/UC-d5c7d493-3deb-4f1a-a49e-52a2e074be4f'
    },
    'ibm-skillsbuild': {
      title: 'Level Up Cybersecurity with Generative AI (IBM SkillsBuild)',
      img: 'assets/certs/ibm-skillsbuild.jpg',
      verify: null
    }
  };
  var dlg = document.getElementById('viewer');
  var vImg = document.getElementById('viewerImg');
  var vTitle = document.getElementById('viewerTitle');
  var vFoot = document.getElementById('viewerFoot');
  var lastTrigger = null;

  function openCert(key, trigger) {
    var c = CERTS[key];
    if (!c) return;
    lastTrigger = trigger;
    vImg.src = c.img;
    vImg.alt = c.title;
    vTitle.textContent = c.title;
    vFoot.innerHTML = '';
    if (c.verify) {
      var a = document.createElement('a');
      a.className = 'text-link';
      a.href = c.verify; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = 'Verify this certificate online';
      vFoot.appendChild(a);
    }
    document.body.classList.add('is-locked');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-cert]'), function (btn) {
    btn.addEventListener('click', function () { openCert(btn.getAttribute('data-cert'), btn); });
  });
  document.getElementById('viewerClose').addEventListener('click', function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', function () {
    document.body.classList.remove('is-locked');
    vImg.removeAttribute('src');
    if (lastTrigger) lastTrigger.focus();
  });

  /* ───────── 3D tilt (mouse only, off for reduced motion) ───────── */
  var canTilt = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
                !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (canTilt) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-tilt]'), function (el) {
      var max = parseFloat(el.getAttribute('data-tilt')) || 5;
      var zone = el.closest('[data-tilt-zone]') || el;
      var frame = null;
      function move(e) {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(function () {
          var r = zone.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width;
          var py = (e.clientY - r.top) / r.height;
          el.style.setProperty('--ry', ((px - 0.5) * 2 * max).toFixed(2) + 'deg');
          el.style.setProperty('--rx', ((0.5 - py) * 2 * max).toFixed(2) + 'deg');
          var er = el.getBoundingClientRect();
          el.style.setProperty('--gx', (e.clientX - er.left) + 'px');
          el.style.setProperty('--gy', (e.clientY - er.top) + 'px');
          el.classList.add('is-tilting');
        });
      }
      function leave() {
        if (frame) cancelAnimationFrame(frame);
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
        el.classList.remove('is-tilting');
      }
      zone.addEventListener('pointermove', move);
      zone.addEventListener('pointerleave', leave);
    });
  }
})();
