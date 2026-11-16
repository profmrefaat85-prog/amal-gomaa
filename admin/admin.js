/* لوحة تحكم موقع أ.د. آمال جمعة
   - الدخول: اسم مستخدم وكلمة مرور تفك تشفير مفتاح GitHub المحفوظ في admin/users.json
   - كل التعديلات تُحفظ في مسودة، وتُعرض للمراجعة (قائمة + معاينة قبل/بعد) قبل النشر
   - النشر = commit واحد على مستودع الموقع، وGitHub Pages يحدّث الموقع خلال دقيقة أو اثنتين
   - المحذوف يذهب إلى admin/archive.json ويمكن استرجاعه */
(function () {
  "use strict";

  var CFG = { owner: "profmrefaat85-prog", repo: "amal-gomaa", branch: "main", site: "https://amal-gomaa.duckdns.org/" };
  var ITER = 310000;
  var $ = function (id) { return document.getElementById(id); };
  var enc = new TextEncoder(), dec = new TextDecoder();

  /* ------------------------------------------------------------------ helpers */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "text") n.textContent = v;
      else if (k === "cls") n.className = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else if (k === "html") n.innerHTML = v;
      else n.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function stamp() { var d = new Date(); return d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + "-" + ("0" + d.getHours()).slice(-2) + ("0" + d.getMinutes()).slice(-2) + ("0" + d.getSeconds()).slice(-2); }
  function fmtDate(iso) { try { return new Date(iso).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return iso; } }
  function toast(msg, kind) {
    var t = el("div", { cls: "toast " + (kind || ""), text: msg });
    $("toasts").appendChild(t);
    setTimeout(function () { t.remove(); }, kind === "err" ? 7000 : 4000);
  }
  function b64(bytes) { var s = "", ch = 0x8000; for (var i = 0; i < bytes.length; i += ch) s += String.fromCharCode.apply(null, bytes.subarray(i, i + ch)); return btoa(s); }
  function unb64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function confirmBox(title, text, yesText, danger) {
    return new Promise(function (res) {
      var d = $("confirm");
      $("cfTitle").textContent = title; $("cfText").textContent = text;
      $("cfYes").textContent = yesText || "تأكيد";
      $("cfYes").className = "btn " + (danger === false ? "primary" : "danger");
      d.returnValue = "";
      d.onclose = function () { res(d.returnValue === "yes"); };
      d.showModal();
    });
  }

  /* ------------------------------------------------------------------ crypto */
  async function deriveKey(pw, salt) {
    var base = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function sealToken(username, pw, token) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    var key = await deriveKey(pw, salt);
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv, additionalData: enc.encode(username) }, key, enc.encode(token)));
    return { salt: b64(salt), iv: b64(iv), ct: b64(ct), iter: ITER };
  }
  async function openToken(rec, pw) {
    var key = await deriveKey(pw, unb64(rec.salt));
    var pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(rec.iv), additionalData: enc.encode(rec.u) }, key, unb64(rec.ct));
    return dec.decode(pt);
  }

  /* ------------------------------------------------------------------ GitHub API */
  var TOKEN = null;
  async function gh(path, opt) {
    opt = opt || {};
    var headers = { "Accept": opt.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    var tk = opt.token || TOKEN;
    if (tk) headers.Authorization = "Bearer " + tk;
    if (opt.body) headers["Content-Type"] = "application/json";
    var r = await fetch("https://api.github.com/repos/" + CFG.owner + "/" + CFG.repo + path, {
      method: opt.method || "GET", headers: headers, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: "no-store"
    });
    if (!r.ok) {
      var err = new Error("GitHub " + r.status); err.status = r.status;
      try { err.detail = (await r.json()).message; } catch (e) { /* ignore */ }
      throw err;
    }
    if (opt.raw) return r.text();
    if (r.status === 204) return null;
    return r.json();
  }
  async function getRaw(path, ref) {
    try { return await gh("/contents/" + encodeURI(path) + "?ref=" + ref, { raw: true }); }
    catch (e) { if (e.status === 404) return null; throw e; }
  }
  function errText(e) {
    if (!e) return "خطأ غير معروف";
    if (e.status === 401) return "مفتاح الوصول غير صالح أو انتهت صلاحيته. اطلب من المسؤول الرئيسي تحديثه.";
    if (e.status === 403) return "مفتاح الوصول لا يملك صلاحية الكتابة على المستودع (" + (e.detail || "403") + ").";
    if (e.status === 404) return "المستودع غير موجود أو المفتاح لا يملك صلاحية عليه.";
    if (e.status === 409 || e.status === 422) return "تعارض مع تعديل آخر على المستودع. أعد تحميل الصفحة وحاول مرة أخرى.";
    if (e.name === "TypeError") return "تعذّر الاتصال بـ GitHub. تأكد من الإنترنت.";
    return (e.message || "خطأ") + (e.detail ? " — " + e.detail : "");
  }

  /* commit several files at once. files: [{path, text}|{path, b64}|{path, sha}|{path, remove:true}] */
  async function commitFiles(files, message) {
    var ref = await gh("/git/ref/heads/" + CFG.branch);
    var headSha = ref.object.sha;
    if (ST.head && headSha !== ST.head) {
      var err = new Error("conflict"); err.conflict = true; err.remoteHead = headSha; throw err;
    }
    var head = await gh("/git/commits/" + headSha);
    var tree = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (f.remove) { tree.push({ path: f.path, mode: "100644", type: "blob", sha: null }); continue; }
      var sha = f.sha;
      if (!sha) {
        var content = f.b64 != null ? f.b64 : b64(enc.encode(f.text));
        sha = (await gh("/git/blobs", { method: "POST", body: { content: content, encoding: "base64" } })).sha;
      }
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: sha });
    }
    var nt = await gh("/git/trees", { method: "POST", body: { base_tree: head.tree.sha, tree: tree } });
    var nc = await gh("/git/commits", { method: "POST", body: { message: message, tree: nt.sha, parents: [headSha] } });
    await gh("/git/refs/heads/" + CFG.branch, { method: "PATCH", body: { sha: nc.sha } });
    return nc.sha;
  }

  /* ------------------------------------------------------------------ content schema */
  var CATS = [["conf", "مؤتمرات"], ["train", "تدريب وقيادة"], ["comm", "خدمة المجتمع"]];
  var LISTS = {
    stats:   { path: ["stats"], title: "الأرقام", sec: "stats", anchor: "stats", needle: function (v) { return [v[1]]; }, label: function (v) { return v[0] + " " + v[1]; }, sub: function (v) { return v[0] + " " + v[2]; },
               fields: [{ k: 0, label: "الرقم", type: "number" }, { k: 1, label: "الوصف بالعربية" }, { k: 2, label: "الوصف بالإنجليزية", ltr: true }] },
    path:    { path: ["path"], title: "المسار الأكاديمي", sec: "path", anchor: "path", needle: function (v) { return [v[1]]; }, label: function (v) { return v[0] + " — " + v[1]; }, sub: function (v) { return v[2]; },
               fields: [{ k: 0, label: "السنة" }, { k: 1, label: "الوصف بالعربية" }, { k: 2, label: "الوصف بالإنجليزية", ltr: true }] },
    deanship:{ path: ["deanship"], title: "إنجازات العمادة", sec: "dean", anchor: "deanship", label: function (v) { return v[0]; }, sub: function (v) { return v[2]; }, needle: function (v) { return [v[0], v[2]]; },
               fields: [{ k: 0, label: "العنوان بالعربية" }, { k: 2, label: "العنوان بالإنجليزية", ltr: true }, { k: 1, label: "التفاصيل بالعربية", area: true }, { k: 3, label: "التفاصيل بالإنجليزية", area: true, ltr: true }] },
    units:   { path: ["units"], title: "المراكز والوحدات", sec: "dean", anchor: "deanship", needle: function (v) { return [v[0]]; }, label: function (v) { return v[0]; }, sub: function (v) { return v[1]; },
               fields: [{ k: 0, label: "الاسم بالعربية" }, { k: 1, label: "الاسم بالإنجليزية", ltr: true }] },
    covers:  { path: ["covers"], title: "أغلفة الكتب (الشريط المتحرك)", sec: "books", anchor: "books", grid: true, label: function (v) { return "غلاف " + v; },
               fields: [{ k: null, label: "صورة الغلاف", type: "image", folder: "assets/books/", mode: "file", prefix: "b-" }] },
    books:   { path: ["books"], title: "قائمة الكتب (تظهر في السيرة الذاتية)", sec: "books", anchor: "#cv-ar", needle: function (v) { return [v[0]]; }, label: function (v) { return v[0] + " (" + v[4] + ")"; }, sub: function (v) { return v[1]; },
               fields: [{ k: 0, label: "عنوان الكتاب بالعربية" }, { k: 1, label: "العنوان بالإنجليزية", ltr: true }, { k: 2, label: "الناشر بالعربية" }, { k: 3, label: "الناشر بالإنجليزية", ltr: true }, { k: 4, label: "سنة النشر", type: "number" }, { k: 5, label: "كتاب مشترك", type: "bool", num: true }] },
    themes:  { path: ["themes"], title: "محاور البحث", sec: "research", anchor: "research", needle: function (v) { return [v.ar]; }, label: function (v) { return v.ar; }, sub: function (v) { return v.en; },
               fields: [{ k: "ar", label: "اسم المحور بالعربية" }, { k: "en", label: "اسم المحور بالإنجليزية", ltr: true }, { k: "items", label: "نماذج من البحوث", type: "pairs" }] },
    events:  { path: ["events"], title: "صور الفعاليات", sec: "events", anchor: "gallery", needle: function (v) { return [v[1]]; }, label: function (v) { return v[1]; }, sub: function (v) { return v[2]; }, img: function (v) { return "assets/events/" + v[0]; },
               fields: [{ k: 0, label: "الصورة", type: "image", folder: "assets/events/", mode: "file", prefix: "ev-" }, { k: 1, label: "الوصف بالعربية", area: true }, { k: 2, label: "الوصف بالإنجليزية", area: true, ltr: true }] },
    certs:   { path: ["certs"], title: "شهادات المشاركة", sec: "certs", anchor: "gallery", needle: function (v) { return [v[2]]; }, label: function (v) { return v[2]; }, sub: function (v) { return v[3]; }, img: function (v) { return "assets/certs/" + v[0] + ".jpg"; },
               fields: [{ k: 0, label: "صورة الشهادة", type: "image", folder: "assets/certs/", mode: "id", prefix: "c-" }, { k: 1, label: "التصنيف", type: "select", options: CATS }, { k: 2, label: "الوصف بالعربية", area: true }, { k: 3, label: "الوصف بالإنجليزية", area: true, ltr: true }] },
    shields: { path: ["shields"], title: "الدروع والتكريمات", sec: "shields", anchor: "honors", needle: function (v) { return [v[1]]; }, label: function (v) { return v[1]; }, sub: function (v) { return v[2]; }, img: function (v) { return "assets/shields/" + v[0] + ".jpg"; },
               fields: [{ k: 0, label: "الصورة", type: "image", folder: "assets/shields/", mode: "id", prefix: "s-" }, { k: 1, label: "الوصف بالعربية", area: true }, { k: 2, label: "الوصف بالإنجليزية", area: true, ltr: true }] },
    initiatives: { path: ["initiatives"], title: "المبادرات الرئاسية", sec: "inits", anchor: "initiatives", label: function (v) { return v[0]; }, sub: function (v) { return v[2]; }, needle: function (v) { return [v[0], v[2]]; },
               fields: [{ k: 0, label: "اسم المبادرة بالعربية" }, { k: 2, label: "اسم المبادرة بالإنجليزية", ltr: true }, { k: 1, label: "الوصف بالعربية", area: true }, { k: 3, label: "الوصف بالإنجليزية", area: true, ltr: true }] },
    cvAr:    { path: ["cv", "ar"], title: "أقسام السيرة الذاتية بالعربية", sec: "cv", anchor: "#cv-ar", needle: function (v) { return [v.h]; }, label: function (v) { return v.h; }, sub: function (v) { return v.books ? "تُعرض تلقائيًا من قائمة الكتب" : (v.list || []).length + " بندًا"; }, subRtl: true,
               fields: [{ k: "h", label: "عنوان القسم" }, { k: "ol", label: "قائمة مرقّمة", type: "bool" }, { k: "list", label: "البنود (كل سطر = بند)", type: "lines" }] },
    cvEn:    { path: ["cv", "en"], title: "أقسام السيرة الذاتية بالإنجليزية", sec: "cv", anchor: "#cv-en", needle: function (v) { return [v.h]; }, ltrAll: true, label: function (v) { return v.h; }, sub: function (v) { return v.books ? "Shown automatically from the books list" : (v.list || []).length + " items"; },
               fields: [{ k: "h", label: "Section heading", ltr: true }, { k: "ol", label: "قائمة مرقّمة", type: "bool" }, { k: "list", label: "البنود (كل سطر = بند)", type: "lines", ltr: true }] }
  };
  var T = function (key, label, area) { return { key: key, label: label, area: !!area }; };
  var SECTIONS = [
    { id: "hero", group: "المحتوى", title: "الواجهة والتعريف", help: "الاسم والمنصب والنبذة والصورة الرئيسية أعلى الصفحة.", portrait: true,
      texts: [T("name1", "الاسم – السطر الأول"), T("name2", "الاسم – السطر الثاني"), T("role", "المنصب"), T("spec", "التخصص"), T("lead", "نبذة قصيرة", true), T("brand", "الاسم المختصر في الشريط العلوي"), T("title", "عنوان الصفحة في المتصفح")] },
    { id: "stats", group: "المحتوى", title: "الأرقام", help: "الإنتاج العلمي بالأرقام أسفل الواجهة.", texts: [T("statsTitle", "عنوان القسم (للقارئات الصوتية)")], lists: ["stats"] },
    { id: "path", group: "المحتوى", title: "المسار الأكاديمي", help: "الخط الزمني للتدرج الوظيفي. ترتيب العناصر هنا هو ترتيبها على الموقع.", texts: [T("pathTitle", "عنوان القسم")], lists: ["path"] },
    { id: "dean", group: "المحتوى", title: "العمادة", help: "نص العمادة والإنجازات والمراكز والوحدات.", texts: [T("deanTitle", "عنوان القسم"), T("deanLead", "النص التعريفي للعمادة", true), T("unitsTitle", "عنوان المراكز والوحدات")], lists: ["deanship", "units"] },
    { id: "books", group: "المحتوى", title: "المؤلفات", help: "أغلفة الكتب في الشريط المتحرك، وقائمة الكتب الكاملة التي تظهر في السيرة الذاتية.", texts: [T("booksTitle", "عنوان القسم"), T("booksLead", "النص التعريفي", true)], lists: ["covers", "books"] },
    { id: "research", group: "المحتوى", title: "محاور البحث", help: "تبويبات محاور البحث ونماذج من البحوث في كل محور.", texts: [T("researchTitle", "عنوان القسم"), T("researchLead", "النص التعريفي", true)], lists: ["themes"] },
    { id: "events", group: "المحتوى", title: "صور الفعاليات", help: "صور من فعاليات العمادة مع وصف لكل صورة. أول صورة هنا هي أول صورة على الموقع.", texts: [T("galleryTitle", "عنوان قسم الفعاليات"), T("galleryLead", "النص التعريفي", true), T("photosTitle", "عنوان مجموعة الصور")], lists: ["events"] },
    { id: "certs", group: "المحتوى", title: "شهادات المشاركة", help: "صور الشهادات مع تصنيفها (مؤتمرات، تدريب وقيادة، خدمة المجتمع).", texts: [T("certsTitle", "عنوان القسم")], lists: ["certs"] },
    { id: "shields", group: "المحتوى", title: "الدروع والتكريمات", help: "صور الدروع والجوائز.", texts: [T("honorsTitle", "عنوان القسم"), T("honorsLead", "النص التعريفي", true)], lists: ["shields"] },
    { id: "inits", group: "المحتوى", title: "المبادرات الرئاسية", help: "", texts: [T("initTitle", "عنوان القسم"), T("initLead", "النص التعريفي", true)], lists: ["initiatives"] },
    { id: "cv", group: "المحتوى", title: "السيرة الذاتية", help: "أقسام السيرة باللغتين. كل بند في سطر مستقل. قسم الكتب يُعرض تلقائيًا من قائمة الكتب في صفحة المؤلفات.", texts: [T("cvTitle", "عنوان صفحة السيرة"), T("cvBandTitle", "عنوان شريط السيرة في الرئيسية"), T("cvBandLead", "نص شريط السيرة")], lists: ["cvAr", "cvEn"] },
    { id: "contact", group: "المحتوى", title: "التواصل والتذييل", help: "", email: true, texts: [T("contactTitle", "عنوان قسم التواصل"), T("contactLead", "العنوان / القسم", true), T("footer", "نص التذييل")] },
    { id: "alltexts", group: "متقدم", title: "كل نصوص الواجهة", help: "كل النصوص الثابتة في الموقع باللغتين (أزرار، عناوين، تلميحات). عدّل بحذر.", allTexts: true },
    { id: "archive", group: "الإدارة", title: "الأرشيف", help: "كل ما تم حذفه من الموقع. يمكن استرجاع أي عنصر إلى مكانه." },
    { id: "history", group: "الإدارة", title: "سجل النشر", help: "آخر عمليات النشر على الموقع. يمكن تحميل أي نسخة سابقة في المسودة لمراجعتها ثم نشرها." },
    { id: "users", group: "الإدارة", title: "المستخدمون", help: "إضافة مسؤولين للصفحة، أو حذفهم، أو تغيير كلمة المرور.", owner: true },
    { id: "account", group: "الإدارة", title: "حسابي", help: "تغيير كلمة المرور الخاصة بك." }
  ];
  var LIST_KEYS = Object.keys(LISTS);

  /* ------------------------------------------------------------------ state */
  var ST = {
    user: null, role: null, head: null, tree: {},
    site0: null, pub: null, draft: null,      // pub/draft: {texts:{ar:{},en:{}}, email, lists:{key:[{uid,v}]}, portrait:{from}|null}
    arch0: [], arch: [], users: { users: [] }, usersSha: null,
    pending: {},                               // path -> dataURL (new images, not yet published)
    restored: {},                              // uid -> archive entry id (restored this session)
    sec: "hero"
  };

  function getPath(o, p) { return p.reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var t = o; for (var i = 0; i < p.length - 1; i++) t = t[p[i]]; t[p[p.length - 1]] = v; }
  function strKeys(site) { return Object.keys(site.ui.ar).filter(function (k) { return typeof site.ui.ar[k] === "string"; }); }

  function wrap(site, match) {
    /* match: optional previous model, to keep uids for equal items */
    var m = { texts: { ar: {}, en: {} }, email: site.email || "", lists: {}, portrait: null };
    strKeys(site).forEach(function (k) { m.texts.ar[k] = site.ui.ar[k]; m.texts.en[k] = site.ui.en[k]; });
    LIST_KEYS.forEach(function (key) {
      var arr = getPath(site, LISTS[key].path) || [];
      var pool = match ? match.lists[key].slice() : [];
      m.lists[key] = arr.map(function (v) {
        var hit = -1;
        for (var i = 0; i < pool.length; i++) if (same(pool[i].v, v)) { hit = i; break; }
        if (hit > -1) { var u = pool[hit].uid; pool.splice(hit, 1); return { uid: u, v: clone(v) }; }
        return { uid: uid(), v: clone(v) };
      });
    });
    return m;
  }
  function unwrap(m) {
    var s = clone(ST.site0);
    Object.keys(m.texts.ar).forEach(function (k) { s.ui.ar[k] = m.texts.ar[k]; s.ui.en[k] = m.texts.en[k]; });
    s.email = m.email;
    LIST_KEYS.forEach(function (key) { setPath(s, LISTS[key].path, m.lists[key].map(function (x) { return clone(x.v); })); });
    return s;
  }
  function parseDataJs(txt) {
    var a = txt.indexOf("/*JSON*/"), b = txt.lastIndexOf("/*END*/");
    if (a < 0 || b < 0) throw new Error("صيغة data.js غير مدعومة");
    return JSON.parse(txt.slice(a + 8, b));
  }
  function buildDataJs(site) {
    return "/* محتوى الموقع — يُكتب تلقائيًا من لوحة التحكم (admin/). لا تعدّل يدويًا إلا عند الضرورة. */\nwindow.SITE = window.__PREVIEW_SITE__ || /*JSON*/" + JSON.stringify(site, null, 1) + "/*END*/;\n";
  }

  /* ------------------------------------------------------------------ images */
  function imgPath(f, val) { return f.folder + (f.mode === "id" ? val + ".jpg" : val); }
  function imgSrc(path) { return ST.pending[path] || ("../" + path + (ST.head ? "?h=" + ST.head.slice(0, 7) : "")); }
  function readImage(file, maxSide) {
    return new Promise(function (res, rej) {
      if (!file || !/^image\//.test(file.type)) return rej(new Error("اختر ملف صورة (JPG أو PNG)."));
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error("تعذّرت قراءة الصورة.")); };
      fr.onload = function () {
        var im = new Image();
        im.onerror = function () { rej(new Error("تعذّرت قراءة الصورة.")); };
        im.onload = function () {
          var s = Math.min(1, maxSide / Math.max(im.width, im.height));
          var c = document.createElement("canvas");
          c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
          var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
          g.drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL("image/jpeg", 0.88));
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  /* ------------------------------------------------------------------ draft persistence */
  function draftKey() { return "agcms-draft:" + ST.user; }
  function saveDraft() {
    updateBar();
    var data = { head: ST.head, draft: ST.draft, arch: ST.arch, restored: ST.restored, pending: ST.pending, at: Date.now() };
    if (!ls(draftKey(), JSON.stringify(data)) && Object.keys(ST.pending).length) {
      data.pending = {}; ls(draftKey(), JSON.stringify(data));
    }
  }
  function clearDraft() { ls(draftKey(), null); }

  /* ------------------------------------------------------------------ diff */
  function itemNeedles(key, v) {
    var L = LISTS[key], out = [];
    if (L.img) out.push({ img: L.img(v) });
    if (key === "covers") out.push({ img: "assets/books/" + v });
    if (L.needle) out = out.concat(L.needle(v));
    return out;
  }
  function fieldVal(f, v) { return f.k === null ? v : v[f.k]; }
  function showVal(f, x) {
    if (f.type === "bool") return x ? "نعم" : "لا";
    if (f.type === "select") { var o = (f.options || []).filter(function (p) { return p[0] === x; })[0]; return o ? o[1] : x; }
    if (f.type === "pairs") return (x || []).map(function (p) { return p[0]; }).join("\n");
    if (f.type === "lines") return (x || []).join("\n");
    return x == null ? "" : String(x);
  }
  function computeChanges() {
    var out = [], P = ST.pub, D = ST.draft;
    // texts
    ["ar", "en"].forEach(function (lg) {
      Object.keys(D.texts[lg]).forEach(function (k) {
        if (P.texts[lg][k] !== D.texts[lg][k]) {
          var sec = SECTIONS.filter(function (s) { return (s.texts || []).some(function (t) { return t.key === k; }); })[0];
          var lab = sec ? sec.texts.filter(function (t) { return t.key === k; })[0].label : k;
          out.push({ kind: "text", secTitle: sec ? sec.title : "نصوص الواجهة", sec: sec ? sec.id : "alltexts", label: lab + (lg === "ar" ? " (عربي)" : " (إنجليزي)"),
            fields: [{ label: "", before: P.texts[lg][k], after: D.texts[lg][k] }], needle: [D.texts[lg][k]], oldNeedle: [P.texts[lg][k]], lang: lg,
            revert: function () { D.texts[lg][k] = P.texts[lg][k]; } });
        }
      });
    });
    if (P.email !== D.email) out.push({ kind: "text", secTitle: "التواصل والتذييل", sec: "contact", label: "البريد الإلكتروني", fields: [{ label: "", before: P.email, after: D.email }], anchor: "contact",
      needle: [D.email], oldNeedle: [P.email], revert: function () { D.email = P.email; } });
    if (D.portrait) out.push({ kind: "edit", secTitle: "الواجهة والتعريف", sec: "hero", label: "الصورة الرئيسية", anchor: "top",
      img: { before: "../assets/img/portrait.jpg", after: D.portrait.src }, needle: [{ img: "assets/img/portrait.jpg" }],
      revert: function () { if (D.portrait.pending) delete ST.pending["assets/img/portrait.jpg"]; D.portrait = null; } });
    // lists
    LIST_KEYS.forEach(function (key) {
      var L = LISTS[key], a = P.lists[key], b = D.lists[key];
      var am = {}, bm = {};
      a.forEach(function (x, i) { am[x.uid] = { x: x, i: i }; });
      b.forEach(function (x, i) { bm[x.uid] = { x: x, i: i }; });
      var secTitle = SECTIONS.filter(function (s) { return (s.lists || []).indexOf(key) > -1; })[0].title;
      var anchor = L.anchor;
      b.forEach(function (x, i) {
        if (!am[x.uid]) {
          var restored = ST.restored[x.uid];
          out.push({ kind: "add", key: key, uid: x.uid, sec: L.sec, secTitle: secTitle, label: (restored ? "استرجاع من الأرشيف: " : "") + L.label(x.v), sub: L.sub && L.sub(x.v), anchor: anchor,
            img: L.img ? { after: imgSrc(L.img(x.v)) } : key === "covers" ? { after: imgSrc("assets/books/" + x.v) } : null, needle: itemNeedles(key, x.v),
            revert: function () {
              var idx = D.lists[key].findIndex(function (y) { return y.uid === x.uid; });
              if (idx > -1) D.lists[key].splice(idx, 1);
              if (restored) { ST.arch.push(restored.entry); delete ST.restored[x.uid]; }
              dropUnusedPending();
            } });
        } else if (!same(am[x.uid].x.v, x.v)) {
          var ov = am[x.uid].x.v, fds = [];
          L.fields.forEach(function (f) {
            var o = fieldVal(f, ov), n = fieldVal(f, x.v);
            if (!same(o, n) && f.type !== "image") fds.push({ label: f.label, before: showVal(f, o), after: showVal(f, n) });
          });
          var imgF = L.fields.filter(function (f) { return f.type === "image"; })[0], im = null;
          if (imgF && !same(fieldVal(imgF, ov), fieldVal(imgF, x.v))) im = { before: imgSrc(imgPath(imgF, fieldVal(imgF, ov))), after: imgSrc(imgPath(imgF, fieldVal(imgF, x.v))) };
          out.push({ kind: "edit", key: key, uid: x.uid, sec: L.sec, secTitle: secTitle, label: L.label(x.v), anchor: anchor, fields: fds, img: im, needle: itemNeedles(key, x.v), oldNeedle: itemNeedles(key, ov),
            revert: function () { bm[x.uid].x.v = clone(ov); dropUnusedPending(); } });
        }
      });
      a.forEach(function (x, i) {
        if (!bm[x.uid]) {
          out.push({ kind: "del", key: key, uid: x.uid, sec: L.sec, secTitle: secTitle, label: L.label(x.v), sub: L.sub && L.sub(x.v), anchor: anchor,
            img: L.img ? { before: imgSrc(L.img(x.v)) } : key === "covers" ? { before: imgSrc("assets/books/" + x.v) } : null, oldNeedle: itemNeedles(key, x.v),
            revert: function () {
              D.lists[key].splice(Math.min(i, D.lists[key].length), 0, { uid: x.uid, v: clone(x.v) });
              ST.arch = ST.arch.filter(function (e) { return e.uid !== x.uid; });
            } });
        }
      });
      var ao = a.filter(function (x) { return bm[x.uid]; }).map(function (x) { return x.uid; });
      var bo = b.filter(function (x) { return am[x.uid]; }).map(function (x) { return x.uid; });
      if (!same(ao, bo)) out.push({ kind: "move", key: key, sec: L.sec, secTitle: secTitle, label: "تغيير ترتيب: " + L.title, anchor: anchor,
        revert: function () {
          var common = D.lists[key].filter(function (x) { return am[x.uid]; });
          common.sort(function (p, q) { return am[p.uid].i - am[q.uid].i; });
          var k = 0; D.lists[key] = D.lists[key].map(function (x) { return am[x.uid] ? common[k++] : x; });
        } });
    });
    // archive permanent deletions
    ST.arch0.forEach(function (e) {
      var still = ST.arch.some(function (x) { return x.id === e.id; });
      var restored = Object.keys(ST.restored).some(function (u) { return ST.restored[u].entry.id === e.id; });
      if (!still && !restored) out.push({ kind: "purge", sec: "archive", secTitle: "الأرشيف", label: "حذف نهائي من الأرشيف: " + e.label,
        revert: function () { ST.arch.push(e); } });
    });
    return out;
  }
  function changeCount() { return computeChanges().length; }
  function dropUnusedPending() {
    var used = usedImagePaths();
    Object.keys(ST.pending).forEach(function (p) { if (!used[p] && p !== "assets/img/portrait.jpg") delete ST.pending[p]; });
  }
  function usedImagePaths() {
    var used = {};
    LIST_KEYS.forEach(function (key) {
      var imgF = LISTS[key].fields.filter(function (f) { return f.type === "image"; })[0];
      if (!imgF) return;
      ST.draft.lists[key].forEach(function (x) { used[imgPath(imgF, fieldVal(imgF, x.v))] = 1; });
    });
    return used;
  }

  /* ------------------------------------------------------------------ UI: chrome */
  function updateBar() {
    var n = changeCount();
    $("reviewBtn").disabled = n === 0;
    $("reviewBtn").textContent = n ? "مراجعة ونشر (" + n + ")" : "مراجعة ونشر";
    $("draftPill").hidden = n === 0;
    $("draftPill").textContent = n === 1 ? "تعديل واحد غير منشور" : n + " تعديلات غير منشورة";
    $("discardBtn").hidden = n === 0;
    renderSide();
  }
  function renderSide() {
    var side = $("side");
    if (!side.dataset.built) {
      side.textContent = "";
      var group = null;
      SECTIONS.forEach(function (s) {
        if (s.owner && ST.role !== "owner") return;
        if (s.group !== group) { group = s.group; side.appendChild(el("h3", { text: group })); }
        side.appendChild(el("button", { type: "button", "data-id": s.id, onclick: function () { go(s.id); } },
          [el("span", { cls: "cdot", title: "به تعديلات غير منشورة", hidden: true }), el("span", { text: s.title }), el("span", { cls: "n" })]));
      });
      side.dataset.built = "1";
    }
    var changed = {}; computeChanges().forEach(function (c) { changed[c.sec] = 1; });
    side.querySelectorAll("button[data-id]").forEach(function (btn) {
      var s = SECTIONS.filter(function (x) { return x.id === btn.dataset.id; })[0], n = "";
      if (s.lists) n = s.lists.reduce(function (a, k) { return a + ST.draft.lists[k].length; }, 0);
      if (s.id === "archive") n = ST.arch.length;
      btn.querySelector(".n").textContent = n === "" ? "" : String(n);
      btn.querySelector(".cdot").hidden = !changed[s.id];
      if (ST.sec === s.id) btn.setAttribute("aria-current", "page"); else btn.removeAttribute("aria-current");
    });
  }
  function go(id) {
    ST.sec = id; ss("agcms-sec", id);
    $("side").classList.remove("open");
    renderMain(); renderSide();
    $("main").focus(); window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------ UI: main pages */
  function renderMain() {
    var s = SECTIONS.filter(function (x) { return x.id === ST.sec; })[0] || SECTIONS[0];
    var m = $("main"); m.textContent = "";
    m.appendChild(el("div", { cls: "page-head" }, [el("h1", { text: s.title })]));
    if (s.help) m.appendChild(el("p", { cls: "help", text: s.help }));
    if (s.id === "archive") return renderArchive(m);
    if (s.id === "history") return renderHistory(m);
    if (s.id === "users") return renderUsers(m);
    if (s.id === "account") return renderAccount(m);
    if (s.portrait) m.appendChild(portraitBlock());
    if (s.email) m.appendChild(emailBlock());
    if (s.allTexts) m.appendChild(textsBlock("النصوص", strKeys(unwrap(ST.draft)).map(function (k) { return T(k, k, (ST.draft.texts.ar[k] || "").length > 70); })));
    else if (s.texts && s.texts.length) m.appendChild(textsBlock("النصوص", s.texts));
    (s.lists || []).forEach(function (key) { m.appendChild(listBlock(key)); });
  }

  function textsBlock(title, texts) {
    var box = el("section", { cls: "block" }, [el("div", { cls: "block-head" }, [el("h2", { text: title })])]);
    var wrapT = el("div", { cls: "texts" });
    texts.forEach(function (t) {
      var row = el("div", { cls: "trow" });
      function sync() { row.classList.toggle("changed", ST.draft.texts.ar[t.key] !== ST.pub.texts.ar[t.key] || ST.draft.texts.en[t.key] !== ST.pub.texts.en[t.key]); }
      row.appendChild(el("b", { text: t.label }));
      ["ar", "en"].forEach(function (lg) {
        var inp = el(t.area ? "textarea" : "input", { dir: lg === "en" ? "ltr" : "rtl", "aria-label": t.label + (lg === "ar" ? " بالعربية" : " بالإنجليزية") });
        inp.value = ST.draft.texts[lg][t.key] == null ? "" : ST.draft.texts[lg][t.key];
        if (t.area) inp.rows = 3;
        inp.addEventListener("input", function () { ST.draft.texts[lg][t.key] = inp.value; sync(); });
        inp.addEventListener("change", saveDraft);
        row.appendChild(el("label", {}, [el("span", { cls: "lang-tag", text: lg === "ar" ? "عربي" : "English" }), inp]));
      });
      sync();
      wrapT.appendChild(row);
    });
    box.appendChild(wrapT);
    return box;
  }

  function emailBlock() {
    var inp = el("input", { type: "email", dir: "ltr", value: ST.draft.email });
    inp.addEventListener("input", function () { ST.draft.email = inp.value.trim(); });
    inp.addEventListener("change", saveDraft);
    return el("section", { cls: "block" }, [el("div", { cls: "block-head" }, [el("h2", { text: "البريد الإلكتروني للتواصل" })]), el("label", {}, [inp])]);
  }

  function portraitBlock() {
    var cur = ST.draft.portrait ? ST.draft.portrait.src : imgSrc("assets/img/portrait.jpg");
    var img = el("img", { src: cur, alt: "الصورة الرئيسية" });
    var file = el("input", { type: "file", accept: "image/*" });
    file.addEventListener("change", async function () {
      try {
        var data = await readImage(file.files[0], 1200);
        ST.pending["assets/img/portrait.jpg"] = data;
        ST.draft.portrait = { src: data, pending: true };
        saveDraft(); renderMain(); toast("تم وضع الصورة الجديدة في المسودة. راجعها قبل النشر.");
      } catch (e) { toast(e.message, "err"); }
    });
    var undo = ST.draft.portrait ? el("button", { cls: "btn ghost sm", type: "button", text: "تراجع عن تغيير الصورة", onclick: function () {
      delete ST.pending["assets/img/portrait.jpg"]; ST.draft.portrait = null; saveDraft(); renderMain(); } }) : null;
    return el("section", { cls: "block" }, [
      el("div", { cls: "block-head" }, [el("h2", { text: "الصورة الرئيسية" }), ST.draft.portrait ? el("span", { cls: "badge edit", text: "معدّلة" }) : null]),
      el("div", { cls: "portrait-edit" }, [img, el("div", {}, [
        el("p", { cls: "hint", text: "يفضّل صورة رسمية رأسية (طول أكبر من العرض) بجودة عالية. الصورة القديمة تُحفظ في الأرشيف تلقائيًا عند النشر." }),
        el("label", { cls: "btn ghost sm filebtn", style: "margin-top:10px" }, ["اختيار صورة جديدة…", file]), undo])])
    ]);
  }

  function listBlock(key) {
    var L = LISTS[key], list = ST.draft.lists[key], pubU = {};
    ST.pub.lists[key].forEach(function (x) { pubU[x.uid] = x; });
    var box = el("section", { cls: "block" });
    box.appendChild(el("div", { cls: "block-head" }, [
      el("h2", { text: L.title }), el("span", { cls: "count", text: "(" + list.length + ")" }), el("span", { cls: "grow" }),
      el("button", { cls: "btn primary sm", type: "button", text: "+ إضافة", onclick: function () { openEditor(key, null); } })
    ]));
    var hasDel = ST.pub.lists[key].length - ST.pub.lists[key].filter(function (x) { return list.some(function (y) { return y.uid === x.uid; }); }).length;
    if (hasDel) box.appendChild(el("p", { cls: "note", text: "تم حذف " + hasDel + " من هذا القسم في المسودة. ستُنقل إلى الأرشيف عند النشر." }));
    if (!list.length) { box.appendChild(el("div", { cls: "empty", text: "لا توجد عناصر. استخدم زر «إضافة»." })); return box; }
    var holder = el("div", { cls: L.grid ? "covers" : "items" });
    list.forEach(function (x, i) {
      var isNew = !pubU[x.uid], isEdit = !isNew && !same(pubU[x.uid].v, x.v);
      var acts = el("div", { cls: "acts" }, [
        el("button", { cls: "icon-btn", type: "button", title: "تحريك لأعلى", "aria-label": "تحريك لأعلى", disabled: i === 0, text: "↑", onclick: function () { move(key, i, -1); } }),
        el("button", { cls: "icon-btn", type: "button", title: "تحريك لأسفل", "aria-label": "تحريك لأسفل", disabled: i === list.length - 1, text: "↓", onclick: function () { move(key, i, 1); } }),
        L.grid ? null : el("button", { cls: "icon-btn", type: "button", title: "تعديل", "aria-label": "تعديل", text: "✎", onclick: function () { openEditor(key, x.uid); } }),
        el("button", { cls: "icon-btn del", type: "button", title: "حذف", "aria-label": "حذف", text: "🗑", onclick: function () { removeItem(key, x.uid); } })
      ]);
      if (L.grid) {
        holder.appendChild(el("div", { cls: "cover" + (isNew ? " is-add" : "") }, [el("img", { src: imgSrc("assets/books/" + x.v), alt: "", loading: "lazy" }), acts]));
        return;
      }
      var thumb = L.img ? el("img", { cls: "thumb", src: imgSrc(L.img(x.v)), alt: "", loading: "lazy" }) : null;
      var sub = L.sub ? L.sub(x.v) : "";
      holder.appendChild(el("div", { cls: "item" + (isNew ? " is-add" : isEdit ? " is-edit" : "") }, [
        thumb,
        el("div", { cls: "txt" }, [
          el("div", { cls: "t1", dir: L.ltrAll ? "ltr" : null }, [isNew ? el("span", { cls: "badge add", text: ST.restored[x.uid] ? "مسترجع" : "جديد" }) : isEdit ? el("span", { cls: "badge edit", text: "معدّل" }) : null, L.label(x.v) || "(بدون عنوان)"]),
          sub ? el("div", { cls: "t2", text: sub, style: L.subRtl ? "direction:rtl;text-align:start" : null }) : null
        ]),
        acts
      ]));
    });
    box.appendChild(holder);
    return box;
  }

  function move(key, i, d) {
    var list = ST.draft.lists[key], j = i + d;
    if (j < 0 || j >= list.length) return;
    var t = list[i]; list[i] = list[j]; list[j] = t;
    saveDraft(); renderMain();
  }

  async function removeItem(key, id) {
    var L = LISTS[key], list = ST.draft.lists[key], idx = list.findIndex(function (x) { return x.uid === id; });
    if (idx < 0) return;
    var x = list[idx], isPub = ST.pub.lists[key].some(function (y) { return y.uid === id; });
    var ok = await confirmBox("حذف «" + (L.label(x.v) || "عنصر") + "»؟",
      isPub ? "سيختفي من الموقع بعد النشر، ويُنقل إلى الأرشيف بحيث يمكن استرجاعه في أي وقت." : "هذا عنصر جديد لم يُنشر بعد، سيُحذف من المسودة.", "حذف");
    if (!ok) return;
    list.splice(idx, 1);
    if (isPub) ST.arch.push({ id: uid(), uid: id, key: key, section: L.title, label: L.label(x.v), item: clone(x.v), index: idx, at: new Date().toISOString(), by: ST.user });
    else if (ST.restored[id]) { ST.arch.push(ST.restored[id].entry); delete ST.restored[id]; }
    dropUnusedPending();
    saveDraft(); renderMain();
    toast(isPub ? "تم الحذف في المسودة. سيُنقل إلى الأرشيف عند النشر." : "تم الحذف.");
  }

  /* ------------------------------------------------------------------ editor */
  var ED = null;
  function blankItem(L) {
    var objKeys = L.fields.some(function (f) { return typeof f.k === "string"; });
    if (L.fields.length === 1 && L.fields[0].k === null) return "";
    var v = objKeys ? {} : [];
    L.fields.forEach(function (f) {
      var d = f.type === "number" ? (f.label.indexOf("سنة") > -1 ? new Date().getFullYear() : 0)
        : f.type === "bool" ? (f.num ? 0 : false) : f.type === "pairs" || f.type === "lines" ? [] : f.type === "select" ? f.options[0][0] : "";
      v[f.k] = d;
    });
    return v;
  }
  function openEditor(key, id) {
    var L = LISTS[key], list = ST.draft.lists[key];
    var cur = id ? list.filter(function (x) { return x.uid === id; })[0] : null;
    ED = { key: key, id: id, v: cur ? clone(cur.v) : blankItem(L), newImg: null };
    $("edTitle").textContent = (id ? "تعديل — " : "إضافة إلى ") + L.title;
    $("edMsg").textContent = "";
    var body = $("edBody"); body.textContent = "";
    if (cur && cur.v && cur.v.books) body.appendChild(el("p", { cls: "note", text: "هذا القسم يعرض قائمة الكتب تلقائيًا من صفحة «المؤلفات». يمكنك هنا تعديل عنوانه فقط." }));
    var grid = el("div", { cls: "grid2" });
    L.fields.forEach(function (f) {
      if (cur && cur.v && cur.v.books && f.k === "list") return;
      var val = f.k === null ? ED.v : ED.v[f.k];
      var full = f.area || f.type === "image" || f.type === "pairs" || f.type === "lines";
      var wrapF;
      if (f.type === "image") {
        var path = val ? imgPath(f, val) : null;
        var pv = el("img", { src: path ? imgSrc(path) : "", alt: "" });
        if (!path) pv.style.visibility = "hidden";
        var file = el("input", { type: "file", accept: "image/*" });
        file.addEventListener("change", async function () {
          try {
            var data = await readImage(file.files[0], f.folder.indexOf("books") > -1 ? 900 : 1600);
            ED.newImg = { f: f, data: data };
            pv.src = data; pv.style.visibility = "visible";
          } catch (e) { $("edMsg").textContent = e.message; }
        });
        wrapF = el("div", { cls: "img-pick full" }, [pv, el("div", { cls: "pick-txt" }, [
          el("b", { text: f.label, style: "color:var(--navy)" }),
          el("p", { text: path ? "لتغيير الصورة اختر ملفًا جديدًا. الصورة القديمة لا تُحذف من المستودع." : "اختر صورة من جهازك. تُصغَّر تلقائيًا للحجم المناسب للموقع." }),
          el("label", { cls: "btn ghost sm filebtn", style: "margin-top:8px" }, [path ? "تغيير الصورة…" : "اختيار صورة…", file])])]);
      } else if (f.type === "bool") {
        var cb = el("input", { type: "checkbox" }); cb.checked = !!val;
        cb.addEventListener("change", function () { ED.v[f.k] = f.num ? (cb.checked ? 1 : 0) : cb.checked; });
        wrapF = el("label", { cls: "check" }, [cb, f.label]);
      } else if (f.type === "select") {
        var sel = el("select", {}, f.options.map(function (o) { return el("option", { value: o[0], text: o[1], selected: o[0] === val }); }));
        sel.addEventListener("change", function () { ED.v[f.k] = sel.value; });
        wrapF = el("label", {}, [f.label, sel]);
      } else if (f.type === "lines") {
        var ta = el("textarea", { rows: 10, dir: f.ltr ? "ltr" : "rtl" }); ta.value = (val || []).join("\n");
        ta.addEventListener("input", function () { ED.v[f.k] = ta.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean); });
        wrapF = el("label", {}, [f.label, ta, el("span", { cls: "hint", text: "اكتب كل بند في سطر مستقل. الأسطر الفارغة تُتجاهل." })]);
      } else if (f.type === "pairs") {
        var pw = el("div", { cls: "pairs" });
        var drawPairs = function () {
          pw.textContent = "";
          pw.appendChild(el("b", { text: f.label, style: "display:block;margin-bottom:8px;color:var(--navy)" }));
          (ED.v[f.k] || []).forEach(function (p, i) {
            var a = el("textarea", { rows: 2, placeholder: "بالعربية" }); a.value = p[0];
            var b = el("textarea", { rows: 2, dir: "ltr", placeholder: "English" }); b.value = p[1];
            a.addEventListener("input", function () { ED.v[f.k][i][0] = a.value; });
            b.addEventListener("input", function () { ED.v[f.k][i][1] = b.value; });
            pw.appendChild(el("div", { cls: "pair" }, [a, b, el("button", { cls: "icon-btn del", type: "button", text: "🗑", "aria-label": "حذف", onclick: function () { ED.v[f.k].splice(i, 1); drawPairs(); } })]));
          });
          pw.appendChild(el("button", { cls: "btn ghost sm", type: "button", text: "+ إضافة بحث", onclick: function () { (ED.v[f.k] = ED.v[f.k] || []).push(["", ""]); drawPairs(); } }));
        };
        drawPairs();
        wrapF = pw;
      } else {
        var inp = el(f.area ? "textarea" : "input", { dir: f.ltr ? "ltr" : "rtl", type: f.type === "number" ? "number" : null, rows: f.area ? 4 : null });
        inp.value = val == null ? "" : val;
        inp.addEventListener("input", function () { ED.v[f.k] = f.type === "number" ? (inp.value === "" ? "" : Number(inp.value)) : inp.value; });
        wrapF = el("label", {}, [f.label, inp]);
      }
      if (full) wrapF.classList.add("full");
      grid.appendChild(wrapF);
    });
    body.appendChild(grid);
    var d = $("editor"); d.returnValue = "";
    d.showModal();
  }
  $("edForm").addEventListener("submit", function (e) {
    var sub = e.submitter && e.submitter.value;
    if (sub !== "save") { ED = null; return; }
    var L = LISTS[ED.key];
    var imgF = L.fields.filter(function (f) { return f.type === "image"; })[0];
    if (imgF && ED.newImg) {
      var name = imgF.mode === "id" ? imgF.prefix + stamp() : imgF.prefix + stamp() + ".jpg";
      if (imgF.k === null) ED.v = name; else ED.v[imgF.k] = name;
      ST.pending[imgPath(imgF, name)] = ED.newImg.data;
    }
    var imgVal = imgF ? fieldVal(imgF, ED.v) : true;
    var firstText = L.fields.filter(function (f) { return !f.type || f.type === "text"; })[0];
    if (imgF && !imgVal) { e.preventDefault(); $("edMsg").textContent = "اختر صورة أولًا."; return; }
    if (firstText && !String(ED.v[firstText.k] || "").trim()) { e.preventDefault(); $("edMsg").textContent = "اكتب «" + firstText.label + "» أولًا."; return; }
    var list = ST.draft.lists[ED.key];
    if (ED.id) list.filter(function (x) { return x.uid === ED.id; })[0].v = ED.v;
    else list.unshift({ uid: uid(), v: ED.v });
    dropUnusedPending();
    saveDraft(); renderMain();
    toast(ED.id ? "تم حفظ التعديل في المسودة." : "تمت الإضافة في أول القائمة. يمكنك تحريكها بالأسهم.");
    ED = null;
  });

  /* ------------------------------------------------------------------ archive page */
  function renderArchive(m) {
    var pendingDel = computeChanges().filter(function (c) { return c.kind === "del"; });
    if (pendingDel.length) m.appendChild(el("p", { cls: "note", text: pendingDel.length + " عنصر محذوف في المسودة سيظهر هنا بعد النشر." }));
    if (!ST.arch.length) { m.appendChild(el("div", { cls: "empty", text: "الأرشيف فارغ." })); return; }
    var secs = {}; ST.arch.forEach(function (e) { secs[e.section] = 1; });
    var f = ss("agcms-archf") || "all";
    var bar = el("div", { cls: "filters" });
    ["all"].concat(Object.keys(secs)).forEach(function (s) {
      bar.appendChild(el("button", { type: "button", "aria-pressed": String(f === s), text: s === "all" ? "الكل" : s, onclick: function () { ss("agcms-archf", s); renderMain(); } }));
    });
    m.appendChild(bar);
    ST.arch.slice().reverse().filter(function (e) { return f === "all" || e.section === f; }).forEach(function (e) {
      var L = LISTS[e.key], th = null;
      if (L && L.img) th = el("img", { cls: "thumb", src: imgSrc(L.img(e.item)), alt: "" });
      else if (e.key === "covers") th = el("img", { cls: "thumb tall", src: imgSrc("assets/books/" + e.item), alt: "" });
      else if (e.key === "portrait") th = el("img", { cls: "thumb tall", src: imgSrc(e.file), alt: "" });
      var isNewArch = !ST.arch0.some(function (x) { return x.id === e.id; });
      m.appendChild(el("div", { cls: "arch item" + (isNewArch ? " pending" : "") }, [th, el("div", { cls: "txt" }, [
        el("div", { cls: "t1" }, [el("span", { cls: "sec", text: e.section }), e.label || "(بدون عنوان)"]),
        el("div", { cls: "meta", text: (isNewArch ? "سيُؤرشف عند النشر — " : "حُذف ") + fmtDate(e.at) + " بواسطة " + e.by })]),
        el("div", { cls: "acts" }, [
          el("button", { cls: "btn ghost sm", type: "button", text: "استرجاع", onclick: function () { restore(e); } }),
          ST.role === "owner" && !isNewArch ? el("button", { cls: "btn ghost sm", type: "button", text: "حذف نهائي", onclick: function () { purge(e); } }) : null
        ])]));
    });
  }
  function restore(e) {
    ST.arch = ST.arch.filter(function (x) { return x.id !== e.id; });
    if (e.key === "portrait") {
      ST.draft.portrait = { src: imgSrc(e.file), fromArchive: e.file, entry: e };
      saveDraft(); toast("ستعود هذه الصورة كصورة رئيسية بعد النشر."); return go("hero");
    }
    var list = ST.draft.lists[e.key];
    var isPub = ST.pub.lists[e.key].some(function (x) { return x.uid === e.uid; });
    var item = { uid: isPub ? e.uid : uid(), v: clone(e.item) };
    if (!isPub) ST.restored[item.uid] = { entry: e };
    list.splice(Math.min(e.index || 0, list.length), 0, item);
    saveDraft(); renderMain();
    toast("تم الاسترجاع في المسودة. راجع ثم انشر ليعود إلى الموقع.");
  }
  async function purge(e) {
    var ok = await confirmBox("حذف نهائي؟", "«" + e.label + "» سيُحذف من الأرشيف ولن يمكن استرجاعه من اللوحة بعد النشر.", "حذف نهائي");
    if (!ok) return;
    ST.arch = ST.arch.filter(function (x) { return x.id !== e.id; });
    saveDraft(); renderMain();
  }

  /* ------------------------------------------------------------------ history page */
  async function renderHistory(m) {
    var holder = el("div", { cls: "block" }, [el("p", { cls: "loading", text: "جارٍ التحميل…" })]);
    m.appendChild(holder);
    try {
      var commits = await gh("/commits?sha=" + CFG.branch + "&per_page=30");
      holder.textContent = "";
      commits.forEach(function (c, i) {
        var msg = c.commit.message.split("\n")[0];
        holder.appendChild(el("div", { cls: "hist" }, [
          el("div", { cls: "grow" }, [el("div", { text: msg }), el("div", { cls: "when", text: fmtDate(c.commit.author.date) + " — " + c.sha.slice(0, 7) + (i === 0 ? " (المنشور حاليًا)" : "") })]),
          i === 0 ? null : el("button", { cls: "btn ghost sm", type: "button", text: "تحميل في المسودة", onclick: function () { loadVersion(c.sha); } })
        ]));
      });
    } catch (e) { holder.textContent = ""; holder.appendChild(el("p", { cls: "msg", text: errText(e) })); }
  }
  async function loadVersion(sha) {
    var ok = await confirmBox("تحميل نسخة سابقة؟", "سيُستبدل محتوى المسودة الحالية بمحتوى هذه النسخة. ستظهر الفروق في شاشة المراجعة ولن يتغير الموقع إلا بعد النشر.", "تحميل", false);
    if (!ok) return;
    try {
      var txt = await getRaw("data.js", sha);
      if (!txt) throw new Error("الملف غير موجود في هذه النسخة.");
      var site = parseDataJs(txt);
      var m = wrap(site, ST.pub);
      m.portrait = ST.draft.portrait;
      LIST_KEYS.forEach(function (key) {
        var have = {}; m.lists[key].forEach(function (x) { have[x.uid] = 1; });
        ST.pub.lists[key].forEach(function (x, i) {
          if (!have[x.uid] && !ST.arch.some(function (e) { return e.uid === x.uid; }))
            ST.arch.push({ id: uid(), uid: x.uid, key: key, section: LISTS[key].title, label: LISTS[key].label(x.v), item: clone(x.v), index: i, at: new Date().toISOString(), by: ST.user });
        });
      });
      ST.draft = m; ST.restored = {};
      // items removed by this version go to archive; items brought back are just "added"
      dropUnusedPending(); saveDraft();
      toast("تم تحميل النسخة في المسودة. افتح «مراجعة ونشر» لرؤية الفروق.");
      go("hero");
    } catch (e) {
      toast(/صيغة/.test(e.message) ? "هذه النسخة أقدم من لوحة التحكم ولا يمكن تحميلها." : errText(e), "err");
    }
  }

  /* ------------------------------------------------------------------ users */
  function renderUsers(m) {
    var box = el("section", { cls: "block users" });
    var tb = el("tbody");
    ST.users.users.forEach(function (u) {
      tb.appendChild(el("tr", {}, [el("td", { text: u.u }), el("td", {}, [el("span", { cls: "role " + u.role, text: u.role === "owner" ? "مسؤول رئيسي" : "محرر" })]),
        el("td", { cls: "meta", text: u.created ? fmtDate(u.created) : "" }),
        el("td", {}, [u.u === ST.user ? el("span", { cls: "meta", text: "أنت" }) : el("button", { cls: "btn ghost sm", type: "button", text: "حذف", onclick: function () { delUser(u.u); } })])]));
    });
    box.appendChild(el("table", {}, [el("thead", {}, [el("tr", {}, [el("th", { text: "المستخدم" }), el("th", { text: "الدور" }), el("th", { text: "تاريخ الإضافة" }), el("th")])]), tb]));
    m.appendChild(box);
    var nu = el("input", { autocomplete: "off", required: true }), np = el("input", { type: "password", autocomplete: "new-password", minlength: 10, required: true });
    var role = el("select", {}, [el("option", { value: "editor", text: "محرر — يعدّل وينشر المحتوى" }), el("option", { value: "owner", text: "مسؤول رئيسي — كمان يدير المستخدمين ويحذف من الأرشيف نهائيًا" })]);
    var msg = el("p", { cls: "msg" });
    var form = el("form", { cls: "block" }, [el("div", { cls: "block-head" }, [el("h2", { text: "إضافة مستخدم" })]),
      el("div", { cls: "grid2" }, [el("label", {}, ["اسم المستخدم", nu]), el("label", {}, ["كلمة المرور (10 أحرف على الأقل)", np]), el("label", { cls: "full" }, ["الدور", role])]),
      el("p", { cls: "hint", text: "أرسل اسم المستخدم وكلمة المرور للشخص بطريقة آمنة، وانصحه بتغيير كلمة المرور من «حسابي» بعد أول دخول." }),
      el("button", { cls: "btn primary", type: "submit", text: "إضافة المستخدم" }), msg]);
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = nu.value.trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(name)) { msg.textContent = "اسم المستخدم: حروف إنجليزية صغيرة وأرقام فقط (3 إلى 30 حرفًا)."; return; }
      if (ST.users.users.some(function (u) { return u.u === name; })) { msg.textContent = "اسم المستخدم موجود بالفعل."; return; }
      if (np.value.length < 10) { msg.textContent = "كلمة المرور قصيرة."; return; }
      msg.className = "msg ok"; msg.textContent = "جارٍ الحفظ…";
      try {
        var rec = Object.assign({ u: name, role: role.value, created: new Date().toISOString(), by: ST.user }, await sealToken(name, np.value, TOKEN));
        await saveUsers(ST.users.users.concat([rec]), "إضافة مستخدم للوحة التحكم: " + name + " (بواسطة " + ST.user + ")");
        toast("تمت إضافة " + name + ".", "ok"); renderMain();
      } catch (er) { msg.className = "msg"; msg.textContent = er.conflict ? "تم نشر تعديل آخر للتو. أعد تحميل الصفحة ثم حاول." : errText(er); }
    });
    m.appendChild(form);
    m.appendChild(el("section", { cls: "block" }, [el("div", { cls: "block-head" }, [el("h2", { text: "ملاحظات أمان" })]),
      el("ul", { cls: "help", style: "padding-inline-start:20px" }, [
        el("li", { text: "كل المستخدمين يستخدمون نفس مفتاح GitHub بعد فك تشفيره بكلمة مرور كل منهم." }),
        el("li", { text: "عند حذف مستخدم لا يستطيع الدخول مرة أخرى. لو تشك أن أحدًا نسخ المفتاح، ألغِ المفتاح من GitHub وأنشئ واحدًا جديدًا ثم أعد إضافة المستخدمين." }),
        el("li", { text: "استخدم كلمات مرور طويلة وغير مكررة." })])]));
  }
  async function delUser(name) {
    var ok = await confirmBox("حذف المستخدم " + name + "؟", "لن يستطيع الدخول إلى اللوحة بعد الآن.", "حذف");
    if (!ok) return;
    try { await saveUsers(ST.users.users.filter(function (u) { return u.u !== name; }), "حذف مستخدم من لوحة التحكم: " + name + " (بواسطة " + ST.user + ")"); toast("تم الحذف.", "ok"); renderMain(); }
    catch (e) { toast(e.conflict ? "تم نشر تعديل آخر للتو. أعد تحميل الصفحة ثم حاول." : errText(e), "err"); }
  }
  async function saveUsers(list, msg) {
    var data = { users: list };
    var sha = await commitFiles([{ path: "admin/users.json", text: JSON.stringify(data, null, 1) + "\n" }], msg);
    ST.users = data; ST.head = sha;
    var d = ls(draftKey()); if (d) { try { var o = JSON.parse(d); o.head = sha; ls(draftKey(), JSON.stringify(o)); } catch (e) { /* ignore */ } }
  }
  function renderAccount(m) {
    var p0 = el("input", { type: "password", autocomplete: "current-password", required: true });
    var p1 = el("input", { type: "password", autocomplete: "new-password", minlength: 10, required: true });
    var p2 = el("input", { type: "password", autocomplete: "new-password", minlength: 10, required: true });
    var msg = el("p", { cls: "msg" });
    var form = el("form", { cls: "block" }, [el("div", { cls: "block-head" }, [el("h2", { text: "تغيير كلمة المرور — " + ST.user })]),
      el("label", {}, ["كلمة المرور الحالية", p0]), el("label", {}, ["كلمة المرور الجديدة (10 أحرف على الأقل)", p1]), el("label", {}, ["تأكيد كلمة المرور الجديدة", p2]),
      el("button", { cls: "btn primary", type: "submit", text: "حفظ كلمة المرور" }), msg]);
    form.addEventListener("submit", async function (e) {
      e.preventDefault(); msg.className = "msg";
      if (p1.value !== p2.value) { msg.textContent = "كلمتا المرور غير متطابقتين."; return; }
      var me = ST.users.users.filter(function (u) { return u.u === ST.user; })[0];
      try { await openToken(me, p0.value); } catch (er) { msg.textContent = "كلمة المرور الحالية غير صحيحة."; return; }
      msg.className = "msg ok"; msg.textContent = "جارٍ الحفظ…";
      try {
        var rec = Object.assign({}, me, await sealToken(ST.user, p1.value, TOKEN));
        await saveUsers(ST.users.users.map(function (u) { return u.u === ST.user ? rec : u; }), "تغيير كلمة مرور " + ST.user);
        msg.textContent = "تم تغيير كلمة المرور."; p0.value = p1.value = p2.value = "";
      } catch (er) { msg.className = "msg"; msg.textContent = er.conflict ? "تم نشر تعديل آخر للتو. أعد تحميل الصفحة ثم حاول." : errText(er); }
    });
    m.appendChild(form);
  }

  /* ------------------------------------------------------------------ review & publish */
  var RV = { mode: "split", dev: "desk", changes: [] };
  function needlesOf(list) { return (list || []).filter(Boolean); }
  function openReview() {
    RV.changes = computeChanges();
    if (!RV.changes.length) return;
    window.__PV = {
      old: { site: unwrap(ST.pub), images: {} },
      new: { site: unwrap(ST.draft), images: Object.assign({}, ST.pending, ST.draft.portrait ? { "assets/img/portrait.jpg": ST.draft.portrait.src } : {}) }
    };
    drawChanges();
    $("rvMsg").textContent = ""; $("rvMsg").className = "msg";
    $("rvPublish").disabled = false;
    $("review").showModal();
    loadFrames(RV.changes[0]);
  }
  function drawChanges() {
    var box = $("rvChanges"); box.textContent = "";
    var words = { add: "إضافة", edit: "تعديل", del: "حذف ← الأرشيف", move: "ترتيب", text: "تعديل نص", purge: "حذف نهائي" };
    var lastSec = null;
    RV.changes.forEach(function (c) {
      if (c.secTitle !== lastSec) { lastSec = c.secTitle; box.appendChild(el("div", { cls: "chg-sec", text: c.secTitle })); }
      var kids = [el("div", { cls: "what", text: words[c.kind] }), el("div", { cls: "lbl", text: c.label })];
      if (c.img) {
        if (c.img.before && c.img.after) kids.push(el("div", { cls: "imgs" }, [el("img", { src: c.img.before, alt: "قبل" }), el("img", { src: c.img.after, alt: "بعد" })]));
        else kids.push(el("img", { src: c.img.after || c.img.before, alt: "" }));
      }
      (c.fields || []).forEach(function (fd) {
        kids.push(el("div", { cls: "fd" }, [fd.label ? el("b", { text: fd.label }) : null, fd.before ? el("del", { text: fd.before }) : null, fd.after ? el("ins", { text: fd.after }) : null]));
      });
      kids.push(el("div", { cls: "row" }, [
        c.anchor ? el("button", { cls: "btn ghost sm", type: "button", text: "اعرض في الموقع", onclick: function () { loadFrames(c); } }) : null,
        el("button", { cls: "btn ghost sm", type: "button", text: "تراجع عن هذا", onclick: function () {
          c.revert(); saveDraft();
          RV.changes = computeChanges();
          if (!RV.changes.length) { $("review").close(); renderMain(); return; }
          window.__PV.new = { site: unwrap(ST.draft), images: Object.assign({}, ST.pending, ST.draft.portrait ? { "assets/img/portrait.jpg": ST.draft.portrait.src } : {}) };
          drawChanges(); loadFrames(null); renderMain();
        } })
      ]));
      var kindCls = c.kind === "purge" ? "purge" : c.kind;
      box.appendChild(el("div", { cls: "chg " + kindCls }, kids));
    });
  }
  function frameTarget(c) {
    var a = c && c.anchor ? c.anchor : null;
    if (a && a.charAt(0) === "#") return { hash: a.slice(1), id: null };
    var lg = c && c.lang === "en" ? "en" : "ar";
    return { hash: lg, id: a };
  }
  function loadFrames(c) {
    var t = frameTarget(c || RV.focus);
    RV.focus = c || RV.focus;
    var ts = Date.now();
    [["frOld", "old"], ["frNew", "new"]].forEach(function (p) {
      var fr = $(p[0]);
      fr.onload = function () { decorate(fr, p[1], t); };
      fr.src = "../index.html?pv=" + p[1] + "&t=" + ts + "#" + t.hash;
    });
  }
  function decorate(fr, which, t) {
    var doc;
    try { doc = fr.contentDocument; } catch (e) { return; }
    if (!doc) return;
    var st = doc.createElement("style");
    st.textContent = ".__add{outline:4px solid #23885A !important;outline-offset:4px;box-shadow:0 0 0 9999px rgba(0,0,0,0) ;background-color:rgba(35,136,90,.10) !important}" +
      ".__edit{outline:4px solid #B7791F !important;outline-offset:4px;background-color:rgba(183,121,31,.10) !important}" +
      ".__del{outline:4px solid #C23B3B !important;outline-offset:4px;background-color:rgba(194,59,59,.10) !important}" +
      "html{scroll-behavior:auto !important}";
    doc.head.appendChild(st);
    setTimeout(function () {
      RV.changes.forEach(function (c) {
        var cls, nds;
        if (which === "new") { if (c.kind === "add") cls = "__add"; else if (c.kind === "edit" || c.kind === "text") cls = "__edit"; nds = c.needle; }
        else { if (c.kind === "del") cls = "__del"; else if (c.kind === "edit" || c.kind === "text") cls = "__edit"; nds = c.oldNeedle; }
        if (!cls) return;
        needlesOf(nds).forEach(function (nd) { mark(doc, nd, cls); });
      });
      if (t.id) { var target = doc.getElementById(t.id); if (target) target.scrollIntoView({ block: "start" }); }
      var first = RV.focus && doc.querySelector(which === "new" ? ".__add,.__edit" : ".__del,.__edit");
      if (first && RV.focus && RV.focus.kind !== "move") {
        var want = needlesOf(which === "new" ? RV.focus.needle : RV.focus.oldNeedle)[0];
        var hit = want ? findNode(doc, want) : null;
        if (hit) hit.scrollIntoView({ block: "center" });
      }
    }, 450);
  }
  function findNode(doc, nd) {
    if (typeof nd === "object" && nd.img) {
      var name = nd.img.split("/").pop(), im = null;
      doc.querySelectorAll("img").forEach(function (i) { var s = i.getAttribute("src") || ""; if (!im && (s.indexOf(name) > -1 || (doc.defaultView.__PREVIEW_IMAGES__ && doc.defaultView.__PREVIEW_IMAGES__[nd.img] === s))) im = i; });
      return im ? (im.closest("li,figure,.book,.arch") || im) : null;
    }
    var txt = String(nd || "").trim();
    if (!txt) return null;
    var best = null;
    doc.querySelectorAll("li,p,strong,b,dd,dt,span,h1,h2,h3,small,a,button").forEach(function (n) {
      if (best) return;
      var c = n.textContent.trim();
      if (c === txt || (txt.length > 25 && c.indexOf(txt) > -1 && c.length < txt.length + 60)) best = n;
    });
    return best ? (best.closest("li") || best) : null;
  }
  function mark(doc, nd, cls) { var n = findNode(doc, nd); if (n) n.classList.add(cls); }

  document.querySelectorAll("[data-pv]").forEach(function (b) {
    b.addEventListener("click", function () {
      RV.mode = b.dataset.pv;
      document.querySelectorAll("[data-pv]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      var p = $("rvPreview"); p.classList.toggle("only-new", RV.mode === "new"); p.classList.toggle("only-old", RV.mode === "old");
    });
  });
  document.querySelectorAll("[data-dev]").forEach(function (b) {
    b.addEventListener("click", function () {
      RV.dev = b.dataset.dev;
      document.querySelectorAll("[data-dev]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      $("rvPreview").classList.toggle("mob", RV.dev === "mob");
    });
  });
  $("rvClose").addEventListener("click", function () { $("review").close(); });

  $("rvPublish").addEventListener("click", async function () {
    var btn = $("rvPublish"), msg = $("rvMsg");
    btn.disabled = true; msg.className = "msg ok"; msg.textContent = "جارٍ النشر… لا تغلق الصفحة.";
    try {
      var changes = computeChanges();
      var counts = { add: 0, edit: 0, del: 0 };
      changes.forEach(function (c) { if (c.kind === "add") counts.add++; else if (c.kind === "del" || c.kind === "purge") counts.del++; else counts.edit++; });
      var site = unwrap(ST.draft);
      var files = [];
      var used = usedImagePaths();
      Object.keys(ST.pending).forEach(function (p) {
        if (p === "assets/img/portrait.jpg") return;
        if (used[p]) files.push({ path: p, b64: ST.pending[p].split(",")[1] });
      });
      var arch = ST.arch.slice();
      if (ST.draft.portrait) {
        var oldSha = ST.tree["assets/img/portrait.jpg"];
        if (oldSha) {
          var apath = "assets/archive/portrait-" + stamp() + ".jpg";
          files.push({ path: apath, sha: oldSha });
          arch.push({ id: uid(), key: "portrait", section: "الصورة الرئيسية", label: "الصورة الرئيسية السابقة", file: apath, at: new Date().toISOString(), by: ST.user });
        }
        if (ST.draft.portrait.pending) files.push({ path: "assets/img/portrait.jpg", b64: ST.pending["assets/img/portrait.jpg"].split(",")[1] });
        else if (ST.draft.portrait.fromArchive) files.push({ path: "assets/img/portrait.jpg", sha: ST.tree[ST.draft.portrait.fromArchive] });
      }
      // permanently purged archive entries: remove their image files if nothing else uses them
      ST.arch0.forEach(function (e) {
        var keep = arch.some(function (x) { return x.id === e.id; }) || Object.keys(ST.restored).some(function (u) { return ST.restored[u].entry.id === e.id; });
        if (keep) return;
        var p = null, L = LISTS[e.key];
        if (e.key === "portrait") p = e.file;
        else if (L) { var f = L.fields.filter(function (x) { return x.type === "image"; })[0]; if (f) p = imgPath(f, fieldVal(f, e.item)); }
        var stillUsed = p && (used[p] || arch.some(function (x) { var L2 = LISTS[x.key]; if (!L2) return x.file === p; var f2 = L2.fields.filter(function (y) { return y.type === "image"; })[0]; return f2 && imgPath(f2, fieldVal(f2, x.item)) === p; }));
        if (p && ST.tree[p] && !stillUsed) files.push({ path: p, remove: true });
      });
      files.push({ path: "data.js", text: buildDataJs(site) });
      files.push({ path: "admin/archive.json", text: JSON.stringify(arch, null, 1) + "\n" });
      var idx = await getRaw("index.html", ST.head);
      if (idx) {
        var v = Date.now().toString(36);
        var nidx = idx.replace(/(data\.js|portrait\.jpg)\?v=[^"']*/g, "$1?v=" + v);
        if (nidx !== idx) files.push({ path: "index.html", text: nidx });
      }
      var note = $("rvNote").value.trim();
      var parts = []; if (counts.add) parts.push(counts.add + " إضافة"); if (counts.edit) parts.push(counts.edit + " تعديل"); if (counts.del) parts.push(counts.del + " حذف");
      var message = "تحديث المحتوى من لوحة التحكم بواسطة " + ST.user + ": " + parts.join("، ") + (note ? "\n\n" + note : "");
      var sha = await commitFiles(files, message);
      // success → published state = draft
      ST.head = sha;
      await refreshTree();
      ST.site0 = site;
      ST.pub = clone(ST.draft); ST.pub.portrait = null; ST.draft.portrait = null;
      ST.arch0 = clone(arch); ST.arch = clone(arch);
      ST.pending = {}; ST.restored = {};
      clearDraft();
      $("rvNote").value = "";
      msg.textContent = "تم النشر بنجاح. التعديلات تظهر على الموقع خلال دقيقة أو اثنتين.";
      toast("تم النشر بنجاح.", "ok");
      updateBar(); renderMain();
      setTimeout(function () { if ($("review").open) $("review").close(); }, 2500);
    } catch (e) {
      btn.disabled = false; msg.className = "msg";
      if (e.conflict) msg.textContent = "شخص آخر نشر تعديلًا بعد فتحك للوحة. انسخ ملاحظاتك، ثم أعد تحميل الصفحة: مسودتك محفوظة وستُعرض عليك.";
      else msg.textContent = "تعذّر النشر: " + errText(e);
    }
  });

  $("reviewBtn").addEventListener("click", openReview);
  $("discardBtn").addEventListener("click", async function () {
    var ok = await confirmBox("إلغاء كل التعديلات غير المنشورة؟", "ستعود المسودة لنفس محتوى الموقع الحالي. لا يمكن التراجع عن ذلك.", "إلغاء التعديلات");
    if (!ok) return;
    ST.draft = clone(ST.pub); ST.arch = clone(ST.arch0); ST.pending = {}; ST.restored = {};
    clearDraft(); updateBar(); renderMain(); toast("تم إلغاء التعديلات.");
  });
  $("menuBtn").addEventListener("click", function () { $("side").classList.toggle("open"); });
  $("logoutBtn").addEventListener("click", async function () {
    if (changeCount()) {
      var ok = await confirmBox("خروج؟", "عندك تعديلات غير منشورة. ستبقى محفوظة على هذا الجهاز وتظهر لك عند الدخول مرة أخرى.", "خروج", false);
      if (!ok) return;
    }
    ss("agcms-session", null); TOKEN = null; location.reload();
  });
  window.addEventListener("beforeunload", function (e) { if (ST.draft && changeCount() && TOKEN) { saveDraft(); } });

  /* ------------------------------------------------------------------ load & auth */
  async function refreshTree() {
    var c = await gh("/git/commits/" + ST.head);
    var t = await gh("/git/trees/" + c.tree.sha + "?recursive=1");
    ST.tree = {}; t.tree.forEach(function (x) { if (x.type === "blob") ST.tree[x.path] = x.sha; });
  }
  async function loadAll() {
    var ref = await gh("/git/ref/heads/" + CFG.branch);
    ST.head = ref.object.sha;
    await refreshTree();
    var txt = await getRaw("data.js", ST.head);
    ST.site0 = parseDataJs(txt);
    ST.pub = wrap(ST.site0);
    ST.draft = clone(ST.pub);
    var a = await getRaw("admin/archive.json", ST.head);
    ST.arch0 = a ? JSON.parse(a) : []; ST.arch = clone(ST.arch0);
    var u = await getRaw("admin/users.json", ST.head);
    ST.users = u ? JSON.parse(u) : { users: [] };
    var me = ST.users.users.filter(function (x) { return x.u === ST.user; })[0];
    if (!me) throw new Error("تم حذف هذا المستخدم.");
    ST.role = me.role;
    // saved draft?
    var raw = ls(draftKey());
    if (raw) {
      try {
        var d = JSON.parse(raw);
        var n = 0;
        if (d.head === ST.head) {
          ST.draft = d.draft; ST.arch = d.arch; ST.pending = d.pending || {}; ST.restored = d.restored || {};
          n = changeCount();
          if (n) toast("تم استرجاع مسودتك غير المنشورة (" + n + " تعديلات).");
        } else {
          var ok = await confirmBox("لديك مسودة قديمة", "عندك تعديلات غير منشورة من " + fmtDate(new Date(d.at).toISOString()) + "، لكن الموقع تغيّر بعدها. هل تريد تحميلها؟ (قد تلغي تعديلات أحدث نشرها شخص آخر — راجعها جيدًا قبل النشر)", "تحميل المسودة", false);
          if (ok) { var site = unwrap(d.draft); ST.draft = wrap(site, ST.pub); ST.draft.portrait = d.draft.portrait; ST.pending = d.pending || {}; ST.arch = d.arch; ST.restored = {}; }
          else clearDraft();
        }
      } catch (e) { clearDraft(); }
    }
  }
  async function startApp() {
    $("auth").hidden = true; $("app").hidden = false;
    $("main").textContent = ""; $("main").appendChild(el("p", { cls: "loading", text: "جارٍ تحميل محتوى الموقع…" }));
    $("userChip").textContent = ST.user;
    try {
      await loadAll();
      ST.sec = ss("agcms-sec") || "hero";
      if (ST.sec === "users" && ST.role !== "owner") ST.sec = "hero";
      updateBar(); renderMain();
    } catch (e) {
      $("main").textContent = "";
      $("main").appendChild(el("div", { cls: "block" }, [el("h2", { text: "تعذّر تحميل المحتوى" }), el("p", { cls: "msg", text: errText(e) }),
        el("button", { cls: "btn primary", type: "button", text: "خروج", onclick: function () { ss("agcms-session", null); location.reload(); } })]));
    }
  }

  var tries = 0, lockUntil = 0;
  $("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var msg = $("lgMsg"); msg.className = "msg";
    if (Date.now() < lockUntil) { msg.textContent = "محاولات كثيرة. انتظر قليلًا ثم حاول."; return; }
    var name = $("lgUser").value.trim().toLowerCase(), pw = $("lgPass").value;
    var rec = (ST.users.users || []).filter(function (u) { return u.u === name; })[0];
    msg.className = "msg ok"; msg.textContent = "جارٍ التحقق…";
    var token = null;
    if (rec) { try { token = await openToken(rec, pw); } catch (er) { token = null; } }
    if (!token) {
      tries++; if (tries >= 5) { lockUntil = Date.now() + 30000; tries = 0; }
      msg.className = "msg"; msg.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة."; return;
    }
    TOKEN = token; ST.user = name;
    ss("agcms-session", JSON.stringify({ u: name, t: token }));
    $("lgPass").value = "";
    startApp();
  });

  $("setupForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var msg = $("stMsg"); msg.className = "msg";
    var token = $("stToken").value.trim(), name = $("stUser").value.trim().toLowerCase(), p1 = $("stPass").value, p2 = $("stPass2").value;
    if (!/^[a-z0-9._-]{3,30}$/.test(name)) { msg.textContent = "اسم المستخدم: حروف إنجليزية صغيرة وأرقام فقط (3 إلى 30 حرفًا)."; return; }
    if (p1.length < 10) { msg.textContent = "كلمة المرور يجب أن تكون 10 أحرف على الأقل."; return; }
    if (p1 !== p2) { msg.textContent = "كلمتا المرور غير متطابقتين."; return; }
    msg.className = "msg ok"; msg.textContent = "جارٍ التحقق من المفتاح…";
    try {
      var repo = await gh("", { token: token });
      if (!repo.permissions || !repo.permissions.push) throw Object.assign(new Error("no push"), { status: 403, detail: "الصلاحية المطلوبة: Contents — Read and write" });
      TOKEN = token; ST.user = name;
      var cur = await getRaw("admin/users.json", CFG.branch);
      var existing = cur ? JSON.parse(cur) : { users: [] };
      if (existing.users.length) { msg.className = "msg"; msg.textContent = "تم إعداد اللوحة بالفعل. ادخل بحسابك."; setTimeout(function () { location.reload(); }, 1500); return; }
      msg.textContent = "جارٍ إنشاء الحساب…";
      var rec = Object.assign({ u: name, role: "owner", created: new Date().toISOString(), by: name }, await sealToken(name, p1, token));
      ST.head = null;
      await commitFiles([{ path: "admin/users.json", text: JSON.stringify({ users: [rec] }, null, 1) + "\n" }], "إعداد لوحة التحكم: إنشاء المسؤول الرئيسي " + name);
      ss("agcms-session", JSON.stringify({ u: name, t: token }));
      $("stToken").value = $("stPass").value = $("stPass2").value = "";
      startApp();
    } catch (er) { TOKEN = null; msg.className = "msg"; msg.textContent = errText(er); }
  });

  async function boot() {
    var sess = ss("agcms-session");
    try {
      var r = await fetch("users.json?t=" + Date.now(), { cache: "no-store" });
      ST.users = r.ok ? await r.json() : { users: [] };
    } catch (e) { ST.users = { users: [] }; }
    if (sess) {
      try { var s = JSON.parse(sess); TOKEN = s.t; ST.user = s.u; return startApp(); } catch (e) { ss("agcms-session", null); }
    }
    $("auth").hidden = false;
    if (!ST.users.users || !ST.users.users.length) $("setupForm").hidden = false;
    else { $("loginForm").hidden = false; $("lgUser").focus(); }
  }
  boot();
})();
