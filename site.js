(function () {
  var S = window.SITE, $ = function (id) { return document.getElementById(id); };
  var A = function (p) { var m = window.__PREVIEW_IMAGES__; return (m && m[p]) || p; };
  var lang = "ar", view = "home", theme = 0, filter = "all";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var L = function (ar, en) { return lang === "ar" ? ar : en; };
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* ---------- lightbox ---------- */
  var lb = $("lb"), lbSet = [], lbIdx = 0;
  function lbShow() {
    var it = lbSet[lbIdx];
    $("lbImg").src = A(it.src); $("lbImg").alt = it.cap; $("lbCap").textContent = it.cap;
    var many = lbSet.length > 1;
    $("lbPrev").hidden = !many; $("lbNext").hidden = !many;
  }
  function lbOpen(set, i) { lbSet = set; lbIdx = i; lbShow(); lb.showModal(); }
  function lbStep(d) { lbIdx = (lbIdx + d + lbSet.length) % lbSet.length; lbShow(); }
  $("lbClose").onclick = function () { lb.close(); };
  $("lbPrev").onclick = function () { lbStep(-1); };
  $("lbNext").onclick = function () { lbStep(1); };
  lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });
  lb.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") lbStep(-1);
    if (e.key === "ArrowRight") lbStep(1);
  });

  function shot(src, cap, set, i, alt) {
    var b = el("button", "shot"); b.type = "button";
    b.setAttribute("aria-label", S.ui[lang].zoom + ": " + cap);
    var im = el("img"); im.src = A(src); im.alt = alt || ""; im.loading = "lazy";
    b.appendChild(im);
    b.onclick = function () { lbOpen(set, i); };
    return b;
  }

  /* ---------- renderers ---------- */
  function renderText() {
    var u = S.ui[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = u.title;
    document.querySelectorAll("[data-t]").forEach(function (n) { n.textContent = u[n.dataset.t]; });
    $("skip").textContent = L("تخطَّ إلى المحتوى", "Skip to content");
    var lbn = $("langBtn");
    lbn.textContent = u.langBtn;
    lbn.lang = u.langTarget; lbn.dir = u.langTarget === "ar" ? "rtl" : "ltr";
    lbn.href = "#" + (view === "cv" ? "cv-" : "") + u.langTarget;
    document.querySelector("[data-home]").href = "#" + lang;
    $("cta1").textContent = u.cta1; $("cta1").href = "#cv-" + lang;
    var other = lang === "ar" ? "en" : "ar";
    $("cta2").textContent = u.cta2; $("cta2").href = "#cv-" + other; $("cta2").lang = other; $("cta2").dir = other === "ar" ? "rtl" : "ltr";
    $("portrait").alt = u.portraitAlt;
    if (window.__PREVIEW_IMAGES__ && window.__PREVIEW_IMAGES__["assets/img/portrait.jpg"]) $("portrait").src = window.__PREVIEW_IMAGES__["assets/img/portrait.jpg"];
    $("booksAll").textContent = u.booksAll; $("booksAll").href = "#cv-" + lang;
    $("cvBack").textContent = u.back; $("cvBack").href = "#" + lang;
    $("cvOther").textContent = u.cvOther; $("cvOther").href = "#" + u.cvOtherTarget;
    $("cvOther").lang = other; $("cvOther").dir = other === "ar" ? "rtl" : "ltr";
    $("lbClose").textContent = "×"; $("lbClose").setAttribute("aria-label", u.close);
    $("lbPrev").textContent = "‹"; $("lbPrev").setAttribute("aria-label", u.prev);
    $("lbNext").textContent = "›"; $("lbNext").setAttribute("aria-label", u.next);
    setMarqueeBtn();

    var nav = $("nav"); nav.textContent = "";
    u.nav.forEach(function (p) {
      var b = el("button", "", p[1]); b.type = "button";
      b.onclick = function () { goSection(p[0]); };
      nav.appendChild(b);
    });
  }

  function goSection(id) {
    function scroll() { var t = $(id); if (t) t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }
    if (view !== "home") { location.hash = lang; setTimeout(scroll, 60); } else scroll();
  }

  function renderStats() {
    var dl = $("stats"); dl.textContent = "";
    S.stats.forEach(function (s) {
      var d = el("div"), dd = el("dd", "", String(s[0])), dt = el("dt", "", L(s[1], s[2]));
      dd.dataset.n = s[0];
      d.appendChild(dd); d.appendChild(dt); dl.appendChild(d);
    });
  }
  function countUp() {
    if (reduce) return;
    document.querySelectorAll("#stats dd").forEach(function (dd) {
      var n = +dd.dataset.n, t0 = null;
      function step(t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / 1400, 1), e = 1 - Math.pow(1 - p, 3);
        dd.textContent = Math.round(n * e);
        if (p < 1) requestAnimationFrame(step);
      }
      dd.textContent = "0"; requestAnimationFrame(step);
    });
  }

  function renderPath() {
    var ol = $("pathList"); ol.textContent = "";
    S.path.forEach(function (p, i) {
      var li = el("li"); li.style.setProperty("--i", i);
      li.appendChild(el("b", "", p[0])); li.appendChild(el("span", "", L(p[1], p[2])));
      ol.appendChild(li);
    });
  }

  function renderDeanship() {
    var ul = $("deeds"); ul.textContent = "";
    S.deanship.forEach(function (d) {
      var li = el("li");
      li.appendChild(el("strong", "", L(d[0], d[2]))); li.appendChild(el("p", "", L(d[1], d[3])));
      ul.appendChild(li);
    });
    var un = $("units"); un.textContent = "";
    S.units.forEach(function (x) { un.appendChild(el("li", "", L(x[0], x[1]))); });
  }

  function renderBooks() {
    var tr = $("track"); tr.textContent = "";
    var cap = S.ui[lang].bookAlt, set = [];
    (S.covers || []).forEach(function (f) { set.push({ src: "assets/books/" + f, cap: cap }); });
    for (var k = 0; k < 2; k++) set.forEach(function (it, i) {
      var b = el("button", "book"); b.type = "button";
      var im = el("img"); im.src = A(it.src); im.loading = "lazy"; im.height = 270;
      if (k === 0) { im.alt = cap; b.setAttribute("aria-label", S.ui[lang].zoom + ": " + cap + " " + (i + 1)); }
      else { im.alt = ""; b.tabIndex = -1; b.setAttribute("aria-hidden", "true"); }
      b.appendChild(im); b.onclick = function () { lbOpen(set, i); };
      tr.appendChild(b);
    });
  }
  function setMarqueeBtn() {
    var m = $("marquee"), b = $("marqueeBtn"), paused = m.classList.contains("paused");
    b.textContent = paused ? S.ui[lang].play : S.ui[lang].pause;
    b.setAttribute("aria-pressed", String(paused));
    b.hidden = reduce;
  }
  $("marqueeBtn").onclick = function () { $("marquee").classList.toggle("paused"); setMarqueeBtn(); };

  function renderResearch() {
    var tabs = $("themeTabs"); tabs.textContent = "";
    S.themes.forEach(function (t, i) {
      var b = el("button", "", L(t.ar, t.en)); b.type = "button"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(i === theme));
      b.onclick = function () { theme = i; renderResearch(); };
      tabs.appendChild(b);
    });
    var ul = $("papers"); ul.textContent = "";
    S.themes[theme].items.forEach(function (p, i) {
      var li = el("li", "", L(p[0], p[1])); li.style.setProperty("--i", i); ul.appendChild(li);
    });
  }

  function renderGallery() {
    var u = S.ui[lang], f = $("filters"); f.textContent = "";
    u.filters.forEach(function (x) {
      var b = el("button", "", x[1]); b.type = "button";
      b.setAttribute("aria-pressed", String(x[0] === filter));
      b.onclick = function () { filter = x[0]; renderGallery(); };
      f.appendChild(b);
    });
    var names = {}; u.filters.forEach(function (x) { names[x[0]] = x[1]; });
    var list = S.certs.filter(function (c) { return filter === "all" || c[1] === filter; });
    var set = list.map(function (c) { return { src: "assets/certs/" + c[0] + ".jpg", cap: L(c[2], c[3]) }; });
    var g = $("certGrid"); g.textContent = "";
    list.forEach(function (c, i) {
      var li = el("li", "card");
      li.appendChild(shot(set[i].src, set[i].cap, set, i));
      li.appendChild(el("span", "tag", names[c[1]]));
      li.appendChild(el("p", "", set[i].cap));
      g.appendChild(li);
    });

    var pb = $("photosBlock"), pg = $("photoGrid"); pg.textContent = "";
    pb.hidden = !S.events.length;
    var pset = S.events.map(function (e) { return { src: "assets/events/" + e[0], cap: L(e[1], e[2]) }; });
    S.events.forEach(function (e, i) {
      var li = el("li", "card");
      li.appendChild(shot(pset[i].src, pset[i].cap, pset, i, pset[i].cap));
      li.appendChild(el("p", "", pset[i].cap));
      pg.appendChild(li);
    });
  }

  function renderShields() {
    var set = S.shields.map(function (s) { return { src: "assets/shields/" + s[0] + ".jpg", cap: L(s[1], s[2]) }; });
    var g = $("shieldGrid"); g.textContent = "";
    set.forEach(function (it, i) {
      var li = el("li"); li.appendChild(shot(it.src, it.cap, set, i)); li.appendChild(el("p", "", it.cap)); g.appendChild(li);
    });
  }

  function renderInits() {
    var ul = $("inits"); ul.textContent = "";
    S.initiatives.forEach(function (x) {
      var li = el("li"); li.appendChild(el("strong", "", L(x[0], x[2]))); li.appendChild(el("p", "", L(x[1], x[3]))); ul.appendChild(li);
    });
  }

  function renderCV() {
    var body = $("cvBody"); body.textContent = "";
    S.cv[lang].forEach(function (sec) {
      var s = el("section", "cv-sec"); s.appendChild(el("h2", "", sec.h));
      var list = el(sec.ol ? "ol" : "ul");
      if (sec.books) {
        S.books.forEach(function (b) {
          var li = el("li", "", L(b[0], b[1]) + L("، ", ", "));
          var joint = b[5] ? L(" (مشترك)", " (joint)") : "";
          li.appendChild(el("small", "", L(b[2], b[3]) + L("، ", ", ") + b[4] + joint));
          list.appendChild(li);
        });
      } else sec.list.forEach(function (t) { list.appendChild(el("li", "", t)); });
      s.appendChild(list); body.appendChild(s);
    });
  }

  function renderAll() {
    renderText(); renderStats(); renderPath(); renderDeanship(); renderBooks();
    renderResearch(); renderGallery(); renderShields(); renderInits(); renderCV();
    $("home").hidden = view !== "home"; $("cv").hidden = view !== "cv";
    observePath();
  }

  /* ---------- scroll-triggered career line ---------- */
  var io;
  function observePath() {
    var p = $("pathList");
    if (reduce || !("IntersectionObserver" in window)) { p.classList.add("on"); return; }
    if (io) io.disconnect();
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { p.classList.add("on"); io.disconnect(); } });
    }, { threshold: 0.35 });
    io.observe(p);
  }

  /* ---------- routing: #ar #en #cv-ar #cv-en ---------- */
  function route(first) {
    var h = (location.hash || "#ar").slice(1);
    var nv = h.indexOf("cv-") === 0 ? "cv" : "home";
    var nl = h.slice(-2) === "en" ? "en" : "ar";
    var changed = nv !== view;
    view = nv; lang = nl;
    renderAll();
    if (changed || first) window.scrollTo(0, 0);
    if (first && view === "home") countUp();
  }
  window.addEventListener("hashchange", function () { route(false); });
  route(true);
})();
