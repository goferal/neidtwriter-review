/* Jeff Neidt — site behaviour */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- hero reveal on load ---- */
  requestAnimationFrame(function () { document.body.classList.add('ready'); });

  /* ---- scroll reveals ---- */
  var targets = document.querySelectorAll('.reveal,.draw');
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (el) { io.observe(el); });

    // Safety net. IntersectionObserver can miss elements under very fast
    // or programmatic scrolling, and a hidden section is worse than an
    // unanimated one — so sweep on every scroll, throttled to one frame.
    // Self-terminating: once everything has revealed, the listener detaches.
    var pending = Array.prototype.slice.call(targets);
    var queued = false;
    function sweep() {
      queued = false;
      pending = pending.filter(function (el) {
        if (el.classList.contains('in')) return false;
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('in');
          return false;
        }
        return true;
      });
      if (!pending.length) window.removeEventListener('scroll', onScrollSweep);
    }
    function onScrollSweep() {
      if (!queued) { queued = true; requestAnimationFrame(sweep); }
    }
    window.addEventListener('scroll', onScrollSweep, { passive: true });
    window.addEventListener('resize', onScrollSweep);
    setTimeout(sweep, 1200);
  } else {
    targets.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- cursor thumbnail over work rows ---- */
  var thumb = document.getElementById('thumb');
  if (thumb) {
    var label = thumb.querySelector('.lbl');
    var active = false, tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

    function loop() {
      cx += (tx - cx) * 0.16; cy += (ty - cy) * 0.16;
      thumb.style.left = cx + 'px'; thumb.style.top = cy + 'px';
      raf = (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5 || active)
        ? requestAnimationFrame(loop) : null;
    }

    document.querySelectorAll('[data-thumb]').forEach(function (row) {
      row.addEventListener('mouseenter', function () {
        if (reduce || window.innerWidth < 900) return;
        label.textContent = row.dataset.thumb + ' — image TK';
        active = true; thumb.classList.add('on');
      });
      row.addEventListener('mouseleave', function () {
        active = false; thumb.classList.remove('on');
      });
    });

    window.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY; if (!raf) loop();
    }, { passive: true });
  }

  /* ---- theme toggle ----
     The <html data-theme> attribute is set by a tiny inline script
     in <head> before paint, so there's no flash. This only handles
     the click and the persistence. */
  var toggle = document.querySelector('.themetoggle');
  if (toggle) {
    var sync = function () {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      toggle.setAttribute('aria-pressed', String(dark));
      toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#16150F' : '#F2EEE4');
    };
    sync();
    toggle.addEventListener('click', function () {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
      // Storage can be unavailable (private mode, sandboxed preview).
      // The toggle must still work if it is — persistence is a bonus.
      try { localStorage.setItem('jn-theme', dark ? 'light' : 'dark'); } catch (e) {}
      sync();
    });
  }

  /* ---- scroll progress ---- */
  var bar = document.querySelector('.progress');
  if (bar && !reduce) {
    var barQueued = false;
    var drawBar = function () {
      barQueued = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(window.scrollY / max, 1) : 0) + ')';
    };
    window.addEventListener('scroll', function () {
      if (!barQueued) { barQueued = true; requestAnimationFrame(drawBar); }
    }, { passive: true });
    window.addEventListener('resize', drawBar);
    drawBar();
  }

  /* ---- nav: hide rule at top, flip over contra bands ---- */
  var nav = document.querySelector('nav');
  if (nav && !document.body.classList.contains('flip')) {
    var bands = document.querySelectorAll('.invert');
    var onScroll = function () {
      nav.style.borderBottomColor = window.scrollY > 8 ? '' : 'transparent';
      var mid = nav.offsetHeight / 2, over = false;
      bands.forEach(function (d) {
        var r = d.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) over = true;
      });
      nav.classList.toggle('contra', over);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  /* ---- form: local-preview guard ----
     The form posts to Netlify. Opened from file:// that would just
     error, so intercept it when there's no host to post to. */
  var form = document.querySelector('form[data-netlify]');
  if (form && location.protocol === 'file:') {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('.btn');
      btn.textContent = 'Wired to Netlify — submits for real once deployed';
      btn.disabled = true;
    });
  }

  /* ---- work filters ---- */
  var filterBar = document.querySelector('.filters');
  if (filterBar) {
    var rows = Array.prototype.slice.call(document.querySelectorAll('.wrow[data-cat]'));
    var countEl = document.getElementById('workcount');

    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var cat = btn.dataset.filter;

      filterBar.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });

      var shown = 0, n = 0;
      rows.forEach(function (row) {
        var match = (cat === 'all' || row.dataset.cat === cat);
        row.hidden = !match;
        if (match) { shown++; row.querySelector('.idx').textContent = String(++n).padStart(2, '0'); }
      });
      if (countEl) countEl.textContent = shown + (shown === 1 ? ' project' : ' projects');
    });
  }
})();
