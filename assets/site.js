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
    var thumbImg = thumb.querySelector('img');
    var active = false, tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

    /* Preload every row image once, so the first hover doesn't show
       an empty frame while the file fetches. */
    document.querySelectorAll('[data-thumb-img]').forEach(function (row) {
      var pre = new Image();
      pre.src = row.dataset.thumbImg;
    });

    function loop() {
      cx += (tx - cx) * 0.16; cy += (ty - cy) * 0.16;
      thumb.style.left = cx + 'px'; thumb.style.top = cy + 'px';
      raf = (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5 || active)
        ? requestAnimationFrame(loop) : null;
    }

    document.querySelectorAll('[data-thumb]').forEach(function (row) {
      row.addEventListener('mouseenter', function () {
        if (reduce || window.innerWidth < 900) return;
        /* A row with an image shows it; one without falls back to the
           label, so a project still previews before its art arrives. */
        if (row.dataset.thumbImg && thumbImg) {
          thumbImg.src = row.dataset.thumbImg;
          thumb.classList.add('hasimg');
        } else {
          label.textContent = row.dataset.thumb;
          thumb.classList.remove('hasimg');
        }
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
        /* data-cat is space-separated — several of Jeff's projects are
           genuinely two kinds at once (UHC and Ball Park are campaign
           and content both), so a row can answer to more than one filter. */
        var match = (cat === 'all' || row.dataset.cat.split(' ').indexOf(cat) !== -1);
        row.hidden = !match;
        if (match) { shown++; row.querySelector('.idx').textContent = String(++n).padStart(2, '0'); }
      });
      if (countEl) countEl.textContent = shown + (shown === 1 ? ' project' : ' projects');
    });
  }

  /* ---- work slideshow ----
     The track is a real scroller in the markup, so with JS off it is
     still a usable swipeable strip — this only adds the arrows, the
     counter and the height behaviour on top.

     Height is the interesting part. The slides keep their natural
     shape, so a 2:3 poster and a 16:9 still are wildly different
     heights; left alone the row would stand at the tallest and every
     wide slide would trail a hole beneath it. So the track is sized
     to the slide you're actually on and transitions between them. */
  var shows = Array.prototype.slice.call(document.querySelectorAll('.shots'));
  shows.forEach(function (show) {
    var track = show.querySelector('.shots-track');
    if (!track) return;
    var slides = Array.prototype.slice.call(track.querySelectorAll('img'));
    if (slides.length < 2) return;

    track.setAttribute('tabindex', '0');
    track.setAttribute('role', 'group');
    track.setAttribute('aria-label', slides.length + ' images, use arrow keys');

    var count = document.createElement('span');
    count.className = 'lbl shots-count';
    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'shots-nav shots-prev';
    prev.setAttribute('aria-label', 'Previous image');
    prev.innerHTML = '&larr;';
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'shots-nav shots-next';
    next.setAttribute('aria-label', 'Next image');
    next.innerHTML = '&rarr;';
    /* One centre line under the picture — arrow, count, arrow. Appended
       in reading order rather than positioned, so the tab order is the
       visual order and no z-index is involved. */
    var bar = document.createElement('div');
    bar.className = 'shots-bar';
    bar.appendChild(prev); bar.appendChild(count); bar.appendChild(next);
    show.appendChild(bar);

    var pad = function (n) { return String(n).padStart(2, '0'); };
    var index = function () { return Math.round(track.scrollLeft / track.clientWidth); };

    /* target, not scrollLeft, is what a click steps from. The track
       scrolls smoothly, so mid-animation scrollLeft still reads the
       old slide — three quick taps on Next would all compute the same
       index and advance one frame. A swipe re-seats target when the
       scroll settles, so both input methods stay agreed. */
    var target = index();
    var sync = function (i) {
      if (i === undefined) i = index();
      count.textContent = pad(i + 1) + ' / ' + pad(slides.length);
      prev.disabled = i <= 0;
      next.disabled = i >= slides.length - 1;
    };
    var go = function (dir) {
      target = Math.min(slides.length - 1, Math.max(0, target + dir));
      track.scrollLeft = target * track.clientWidth;
      sync(target);
    };

    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });

    var st;
    var settle = function () { target = index(); sync(target); };
    track.addEventListener('scroll', function () {
      clearTimeout(st); st = setTimeout(settle, 90);
    });
    window.addEventListener('resize', function () {
      clearTimeout(st); st = setTimeout(settle, 150);
    });

    sync();
  });

  /* ---- stills rows that scroll ----
     Below 640px .stills becomes a horizontal snap scroller. A region
     you can scroll has to be reachable by keyboard too, or the images
     past the first are unreachable without a pointer — so any row that
     actually overflows gets focus and a name. Re-checked on resize
     because the same row is an ordinary grid on a wider screen, where
     a tabindex would just be a dead stop in the tab order. */
  var stills = Array.prototype.slice.call(document.querySelectorAll('.stills'));
  if (stills.length) {
    var syncScrollers = function () {
      stills.forEach(function (row) {
        var scrolls = row.scrollWidth > row.clientWidth + 1;
        if (scrolls) {
          row.setAttribute('tabindex', '0');
          row.setAttribute('role', 'group');
          row.setAttribute('aria-label', row.querySelectorAll('img').length + ' images, scrollable');
        } else {
          row.removeAttribute('tabindex');
          row.removeAttribute('role');
          row.removeAttribute('aria-label');
        }
      });
    };
    syncScrollers();
    window.addEventListener('load', syncScrollers);
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt); rt = setTimeout(syncScrollers, 150);
    });
  }

  /* ---- click-to-play film leads ----
     A lead still with [data-embed] swaps itself for the player in place.
     Without this the anchor just leaves for Vimeo, which reads as the CTA
     doing nothing (Jeff, Aug 2026) — and costs the visitor the page.

     The markup stays a real <a href> so it still works with JS off, or
     when the film lives somewhere that can't be embedded (LiftOne sits on
     UltraVideo's own site, so it has no data-embed and keeps leaving).
     Nothing is requested from Vimeo until the click. */
  document.querySelectorAll('.playlink[data-embed]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      var slot = document.createElement('div');
      slot.className = 'videoslot';
      slot.style.aspectRatio = link.dataset.ratio || '16/9';
      var f = document.createElement('iframe');
      f.src = link.dataset.embed + (link.dataset.embed.indexOf('?') < 0 ? '?' : '&') +
              'autoplay=1&dnt=1&title=0&byline=0&portrait=0';
      f.title = link.getAttribute('aria-label') || 'Video';
      f.allow = 'autoplay; fullscreen; picture-in-picture';
      f.setAttribute('allowfullscreen', '');
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      slot.appendChild(f);
      link.replaceWith(slot);
    });
  });
})();
