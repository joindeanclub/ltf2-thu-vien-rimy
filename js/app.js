/* Farm LTF2 – thư viện văn bản, công vụ và cẩm nang vận hành (trang tĩnh trên GitHub Pages, chỉ đọc). */
(function () {
  "use strict";

  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  var PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  var LS_SET = "ltf2.settings.v2";
  var TAN = ["Hằng ngày", "Hằng tuần", "Hằng tháng", "Mỗi lần", "Khi có sự cố", "Một lần"];
  var THEMES = ["", "light", "dark"];

  var S = {
    docs: [], nhom: [], cv: [], cats: [], tra: [], cn: null, settings: {},
    tab: "thuvien", dNhom: "", dTan: "", dq: "", cq: "", cCat: "", cvOpen: "", open: {}, traOpen: false
  };

  // ---------- Tiện ích ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function toast(m) { var t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2300); }
  function nhomName(k) { for (var i = 0; i < S.nhom.length; i++) if (S.nhom[i].ma === k) return S.nhom[i].ten; return k; }
  function docBy(ma) { for (var i = 0; i < S.docs.length; i++) if (S.docs[i].ma === ma) return S.docs[i]; return null; }
  function cvBy(id) { for (var i = 0; i < S.cv.length; i++) if (S.cv[i].id === id) return S.cv[i]; return null; }
  function absUrl(rel) { return new URL(rel.split("/").map(encodeURIComponent).join("/"), location.href).href; }
  function loadJSON(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }
  function chip(label, on, attr, count) {
    return '<button class="chip' + (on ? " on" : "") + '" ' + attr + ">" + esc(label) + (count != null ? "<small>" + count + "</small>" : "") + "</button>";
  }
  function docChip(ma) {
    var d = docBy(ma);
    return '<span class="tag doc" data-doc="' + esc(ma) + '" title="' + esc(d ? d.ten : ma) + '">' + esc(ma) + "</span>";
  }
  function cvChip(id) {
    var w = cvBy(id);
    return '<span class="tag cvtag" data-cv="' + esc(id) + '" title="' + esc(w ? w.ten : id) + '">' + esc(id) + "</span>";
  }
  function applyTheme() {
    var t = S.settings.theme || "";
    if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme");
    $("#btnTheme").textContent = t === "dark" ? "☾" : t === "light" ? "☀" : "◐";
  }

  // ---------- Khởi động ----------
  function init() {
    S.settings = lsGet(LS_SET, {});
    Promise.all([loadJSON("data/documents.json"), loadJSON("data/workflows.json")]).then(function (r) {
      S.docs = r[0].van_ban; S.nhom = r[0].nhom; S.cn = r[0].cam_nang || null;
      S.cv = r[1].cong_vu; S.cats = r[1].cats; S.tra = r[1].tra_nhanh || [];
      bind(); applyTheme(); render();
      if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
    }).catch(function () {
      $("#view").innerHTML = '<div class="empty">Không tải được dữ liệu. Hãy mở trang qua địa chỉ GitHub Pages (không mở trực tiếp file).</div>';
    });
  }
  function bind() {
    document.querySelectorAll(".tabs button").forEach(function (b) {
      b.addEventListener("click", function () { S.tab = b.getAttribute("data-tab"); S.cvOpen = ""; render(); window.scrollTo(0, 0); });
    });
    $("#btnTheme").addEventListener("click", function () {
      var i = THEMES.indexOf(S.settings.theme || "");
      S.settings.theme = THEMES[(i + 1) % THEMES.length]; lsSet(LS_SET, S.settings); applyTheme();
    });
    $("#scrim").addEventListener("click", closeSheet);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (!$("#viewer").hidden) closeViewer(); else closeSheet(); } });
    $("#view").addEventListener("click", onViewClick);
    $("#view").addEventListener("input", onViewInput);
    $("#sheet").addEventListener("click", onSheetClick);
    $("#vClose").onclick = closeViewer;
  }
  function render() {
    document.querySelectorAll(".tabs button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === S.tab); });
    var v = $("#view"), sub = "";
    if (S.tab === "thuvien") { v.innerHTML = viewThuVien(); sub = "Thư viện văn bản"; }
    else if (S.tab === "congvu") { v.innerHTML = S.cvOpen ? viewCvDetail(S.cvOpen) : viewCongVu(); sub = S.cvOpen ? "Sơ đồ giải quyết công vụ" : "Công vụ và văn bản đi kèm"; }
    else { v.innerHTML = viewCamNang(); sub = "Cẩm nang vận hành"; }
    $("#sub").textContent = sub;
  }

  // ---------- Thư viện ----------
  function tanMatch(ts, f) {
    if (!f) return true;
    var s = ts.toLowerCase();
    if (f === "Mỗi lần") return s.indexOf("mỗi") === 0 || (s.indexOf("khi") === 0 && s.indexOf("sự cố") < 0);
    if (f === "Hằng tháng") return s.indexOf("tháng") >= 0;
    if (f === "Hằng tuần") return s.indexOf("tuần") >= 0;
    return s.indexOf(f.toLowerCase()) >= 0;
  }
  function viewThuVien() {
    var q = S.dq.trim().toLowerCase();
    var h = '<input class="search" id="dq" type="search" placeholder="Tìm văn bản: mã, tên, mục đích…" value="' + esc(S.dq) + '">';
    h += '<div class="chips">' + chip("Mọi nhóm", !S.dNhom, 'data-dn=""');
    S.nhom.forEach(function (n) { h += chip(n.ten, S.dNhom === n.ma, 'data-dn="' + n.ma + '"'); });
    h += '</div><div class="chips">' + chip("Mọi tần suất", !S.dTan, 'data-dt=""');
    TAN.forEach(function (t) { h += chip(t, S.dTan === t, 'data-dt="' + t + '"'); });
    h += "</div>";
    var searching = !!(q || S.dTan || S.dNhom), any = false;
    if (S.cn && !searching) h += cnCard();
    h += '<div class="tree">';
    S.nhom.forEach(function (n) {
      if (S.dNhom && S.dNhom !== n.ma) return;
      var list = S.docs.filter(function (d) {
        if (d.nhom !== n.ma) return false;
        if (!tanMatch(d.tan_suat, S.dTan)) return false;
        return !q || (d.ma + " " + d.ten + " " + d.dung_khi + " " + d.tan_suat).toLowerCase().indexOf(q) >= 0;
      });
      if (!list.length) return;
      any = true;
      var open = searching || S.open[n.ma];
      h += '<section class="folder"><button class="fold" data-fold="' + n.ma + '" aria-expanded="' + (open ? "true" : "false") + '">' +
        '<span class="arr">' + (open ? "▾" : "▸") + '</span><span class="fn">📁 ' + esc(n.ten) + "</span><small>" + list.length + "</small></button>";
      if (open) {
        h += '<div class="files">';
        list.forEach(function (d) {
          h += '<article class="file" data-doc="' + esc(d.ma) + '"><span class="code">' + esc(d.ma) + "</span>" +
            "<div><h3>" + esc(d.ten) + "</h3><p>" + esc(d.tan_suat) + " · " + esc(d.kho) + ", " + d.trang + " trang</p></div><span class='pdf'>PDF</span></article>";
        });
        h += "</div>";
      }
      h += "</section>";
    });
    h += "</div>";
    if (!any) h += '<div class="empty">Không có văn bản nào khớp.</div>';
    h += '<p class="note">Văn bản ở dạng PDF để xem, in, lưu; không chỉnh sửa trực tiếp được. Không chứa hợp đồng, số căn cước hay số liệu tài chính.</p>';
    return h;
  }
  function cnCard() {
    return '<article class="card cn-card"><span class="cn-ico">📘</span><div><h3>' + esc(S.cn.ten) + "</h3><p>" + esc(S.cn.mo_ta) + "</p>" +
      '<div class="btns"><button class="btn pri" data-view="CAM-NANG">Xem cẩm nang</button>' +
      '<a class="btn" style="text-align:center;text-decoration:none" href="' + esc(absUrl(S.cn.file)) + '" target="_blank" rel="noopener">Mở bằng trình đọc PDF</a></div></div></article>';
  }

  // ---------- Công vụ ----------
  function viewCongVu() {
    var q = S.cq.trim().toLowerCase();
    var h = '<input class="search" id="cq" type="search" placeholder="Tìm công vụ hoặc vụ việc: mua sắm, nghiệm thu, cua chết…" value="' + esc(S.cq) + '">';
    // Tra nhanh theo vụ việc
    var tr = S.tra.filter(function (t) { return !q || (t.vu_viec + " " + t.cong_vu.join(" ") + " " + t.van_ban.join(" ")).toLowerCase().indexOf(q) >= 0; });
    var open = S.traOpen || (q && tr.length);
    h += '<section class="card tra"><button class="fold" data-tra="1" aria-expanded="' + (open ? "true" : "false") + '">' +
      '<span class="arr">' + (open ? "▾" : "▸") + '</span><span class="fn">🔎 Tra nhanh: gặp vụ việc gì thì làm gì</span><small>' + S.tra.length + "</small></button>";
    if (open) {
      h += '<div class="tra-list">';
      tr.forEach(function (t) {
        h += '<div class="tra-row"><div class="tra-t"><strong>' + esc(t.vu_viec) + '</strong><span class="tag lvl">Mức ' + esc(t.muc) + "</span></div>" +
          '<div class="meta"><span class="mut">Công vụ:</span>' + t.cong_vu.map(cvChip).join("") + "</div>" +
          '<div class="meta"><span class="mut">Văn bản:</span>' + t.van_ban.map(docChip).join("") + "</div></div>";
      });
      if (!tr.length) h += '<div class="empty">Không có vụ việc nào khớp.</div>';
      h += "</div>";
    }
    h += "</section>";
    h += '<div class="chips">' + chip("Tất cả công vụ", !S.cCat, 'data-cc=""');
    S.cats.forEach(function (c) { h += chip(c.ico + " " + c.ten, S.cCat === c.ma, 'data-cc="' + c.ma + '"'); });
    h += "</div>";
    var any = false;
    S.cats.forEach(function (c) {
      if (S.cCat && S.cCat !== c.ma) return;
      var list = S.cv.filter(function (w) {
        if (w.cat !== c.ma) return false;
        if (!q) return true;
        var docs = w.bat_buoc.concat(w.thuong_dung, w.tham_chieu).join(" ");
        return (w.ten + " " + w.mo_ta + " " + w.khi_nao + " " + docs).toLowerCase().indexOf(q) >= 0;
      });
      if (!list.length) return;
      any = true;
      h += '<section class="group"><h2>' + esc(c.ico + " " + c.ten) + "<small>" + list.length + " công vụ</small></h2>";
      list.forEach(function (w) {
        h += '<article class="card cvc" data-cv="' + w.id + '"><div class="cvh"><span class="code cv">' + esc(w.id.replace("CV-", "")) + "</span>" +
          "<div><h3>" + esc(w.ten) + "</h3><p>" + esc(w.khi_nao) + "</p></div></div>" +
          '<div class="meta">' + w.bat_buoc.map(docChip).join("") + '<span class="tag">' + w.buoc.length + " bước</span></div></article>";
      });
      h += "</section>";
    });
    if (!any && !(q && tr.length)) h += '<div class="empty">Không có công vụ nào khớp.</div>';
    h += '<p class="note">Ban Quản lý chất lượng và Ban Kinh doanh nói đến trong sơ đồ thuộc Công ty Cổ phần Công nghệ Nông nghiệp LITECH.</p>';
    return h;
  }
  function viewCvDetail(id) {
    var w = cvBy(id); if (!w) return "";
    var h = '<button class="back" data-cv-back="1">← Danh sách công vụ</button>';
    h += '<div class="card"><h2 class="cv-title">' + esc(w.ten) + "</h2><p class='mute'>" + esc(w.mo_ta) + "</p>" +
      '<dl class="kv"><dt>Khi nào</dt><dd>' + esc(w.khi_nao) + "</dd><dt>Ai tham gia</dt><dd>" + esc(w.ai) + "</dd></dl></div>";
    h += '<h2 class="sec">Sơ đồ giải quyết</h2><ol class="flow">';
    var stepNo = 0;
    w.buoc.forEach(function (b) {
      if (b.qd) {
        h += '<li class="node dec"><span class="n">?</span><div class="box"><strong>' + esc(b.qd.hoi) + "</strong>" +
          '<div class="br"><span class="yes">Có</span><p>' + esc(b.qd.co) + "</p></div>" +
          '<div class="br"><span class="no">Không</span><p>' + esc(b.qd.khong) + "</p></div></div></li>";
      } else {
        stepNo++;
        h += '<li class="node"><span class="n">' + stepNo + '</span><div class="box"><strong>' + esc(b.ten) + "</strong>" +
          '<div class="who">👤 ' + esc(b.ai) + "</div>" + (b.ghi ? '<div class="mute small">' + esc(b.ghi) + "</div>" : "") +
          (b.vb.length ? '<div class="meta">' + b.vb.map(docChip).join("") + "</div>" : "") + "</div></li>";
      }
    });
    h += "</ol>";
    function group(title, list, cls) {
      if (!list.length) return "";
      var s = '<h2 class="sec">' + title + "</h2>";
      list.forEach(function (ma) {
        var d = docBy(ma); if (!d) return;
        s += '<article class="card doc" data-doc="' + esc(ma) + '"><span class="code ' + cls + '">' + esc(ma) + "</span><div><h3>" + esc(d.ten) + "</h3><p>" + esc(d.dung_khi) + "</p></div></article>";
      });
      return s;
    }
    h += group("Văn bản bắt buộc", w.bat_buoc, "");
    h += group("Văn bản thường dùng kèm", w.thuong_dung, "alt");
    h += group("Quy định, báo cáo tham chiếu", w.tham_chieu, "alt2");
    if (w.luu_y.length) h += '<h2 class="sec">Lưu ý</h2><div class="note">' + w.luu_y.map(esc).join("<br>") + "</div>";
    return h;
  }

  // ---------- Cẩm nang ----------
  function viewCamNang() {
    if (!S.cn) return '<div class="empty">Chưa có cẩm nang.</div>';
    var h = cnCard();
    h += '<h2 class="sec">Trong cẩm nang có gì</h2><div class="card"><ul class="plain">' +
      "<li><b>MENU</b> bấm được: chuyển thẳng tới chương hoặc văn bản liên quan.</li>" +
      "<li><b>Phần A:</b> Farm LTF2, Ban Quản lý Farm, 8 nguyên tắc vận hành, các giai đoạn một vụ nuôi.</li>" +
      "<li><b>Phần B:</b> 19 công vụ, mỗi công vụ có sơ đồ bước, người làm, văn bản đi kèm.</li>" +
      "<li><b>Phần C:</b> xử lý vụ việc phát sinh (ba mức), bảng tra nhanh, lịch việc hằng ngày, tuần, tháng.</li>" +
      "<li><b>Phụ lục:</b> 37 văn bản mẫu, mỗi trang có thẻ “▲ Về menu” ở lề trái.</li></ul></div>";
    h += '<h2 class="sec">Cách in</h2><div class="note">In khổ A4, tỷ lệ 100% (không chọn “thu nhỏ vừa trang”) để giữ lề 12 mm, riêng lề trái 19 mm. ' +
      "Chấm trong biểu mẫu là chỗ ghi tay.</div>";
    h += '<div class="btns"><button class="btn" id="goLib">Mở thư viện văn bản</button><button class="btn" id="goCv">Mở danh sách công vụ</button></div>';
    return h;
  }

  // ---------- Sự kiện ----------
  function onViewInput(e) {
    var t = e.target;
    if (t.id === "dq") { S.dq = t.value; keepFocus("dq", viewThuVien); }
    else if (t.id === "cq") { S.cq = t.value; keepFocus("cq", viewCongVu); }
  }
  function keepFocus(id, fn) {
    var pos = $("#" + id).selectionStart;
    $("#view").innerHTML = fn();
    var el = $("#" + id); el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {}
  }
  function onViewClick(e) {
    var el = e.target.closest("[data-dn],[data-dt],[data-cc],[data-doc],[data-cv],[data-cv-back],[data-fold],[data-tra],[data-view],button");
    if (!el) return;
    var d = el.dataset;
    if (d.dn !== undefined) { S.dNhom = d.dn; return render(); }
    if (d.dt !== undefined) { S.dTan = d.dt; return render(); }
    if (d.cc !== undefined) { S.cCat = d.cc; return render(); }
    if (d.view) return openViewer(d.view);
    if (d.fold) { S.open[d.fold] = !S.open[d.fold]; return render(); }
    if (d.tra) { S.traOpen = !S.traOpen; return render(); }
    if (d.cvBack) { S.cvOpen = ""; render(); return window.scrollTo(0, 0); }
    if (d.doc) return docSheet(d.doc);
    if (d.cv) { S.tab = "congvu"; S.cvOpen = d.cv; render(); return window.scrollTo(0, 0); }
    if (el.id === "goLib") { S.tab = "thuvien"; render(); return window.scrollTo(0, 0); }
    if (el.id === "goCv") { S.tab = "congvu"; S.cvOpen = ""; render(); return window.scrollTo(0, 0); }
  }
  function onSheetClick(e) {
    var el = e.target.closest("[data-doc],[data-open-cv],[data-view],[data-print],#dClose");
    if (!el) return;
    var d = el.dataset;
    if (el.id === "dClose") return closeSheet();
    if (d.view) return openViewer(d.view);
    if (d.print) return printDoc(d.print);
    if (d.openCv) { closeSheet(); S.tab = "congvu"; S.cvOpen = d.openCv; render(); return window.scrollTo(0, 0); }
    if (d.doc) return docSheet(d.doc);
  }

  // ---------- Hộp thông tin văn bản ----------
  function openSheet(html) { $("#sheet").innerHTML = html; $("#sheetWrap").hidden = false; $("#sheet").scrollTop = 0; }
  function closeSheet() { $("#sheetWrap").hidden = true; $("#sheet").innerHTML = ""; }
  function docSheet(ma) {
    var d = docBy(ma); if (!d) return;
    var cvs = (d.cong_vu || []).map(cvBy).filter(Boolean);
    var ctxt = cvs.map(function (w) { return '<button class="chip" data-open-cv="' + w.id + '">' + esc(w.id.replace("CV-", "") + " · " + w.ten) + "</button>"; }).join("");
    openSheet("<h2>" + esc(d.ma) + " – " + esc(d.ten) + "</h2>" +
      '<dl class="kv"><dt>Nhóm</dt><dd>' + esc(nhomName(d.nhom)) + "</dd><dt>Dùng khi</dt><dd>" + esc(d.dung_khi) + "</dd>" +
      "<dt>Tần suất</dt><dd>" + esc(d.tan_suat) + "</dd><dt>Khổ giấy</dt><dd>A4 " + esc(d.kho.toLowerCase()) + ", " + d.trang + " trang</dd>" +
      "<dt>Người ký</dt><dd>" + esc(d.ky) + "</dd></dl>" +
      '<div class="btns"><button class="btn pri" data-view="' + esc(ma) + '">Xem văn bản</button>' +
      '<button class="btn" data-print="' + esc(ma) + '">In</button>' +
      '<a class="btn" style="text-align:center;text-decoration:none" href="' + esc(absUrl(d.file)) + '" download>Tải PDF</a></div>' +
      (ctxt ? '<h3 class="mini">Dùng trong công vụ</h3><div class="chips wrap">' + ctxt + "</div>" : "") +
      '<div class="btns"><button class="btn" id="dClose">Đóng</button></div>');
  }

  // ---------- Xem, in PDF (chỉ đọc) ----------
  var pdfLib = null;
  function loadPdfJs() {
    if (pdfLib) return Promise.resolve(pdfLib);
    return new Promise(function (res, rej) {
      if (window.pdfjsLib) { pdfLib = window.pdfjsLib; pdfLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return res(pdfLib); }
      var s = document.createElement("script"); s.src = PDFJS; s.async = true;
      s.onload = function () { pdfLib = window.pdfjsLib; pdfLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; res(pdfLib); };
      s.onerror = function () { rej(new Error("pdfjs")); };
      document.head.appendChild(s);
    });
  }
  function fileOf(ma) { return ma === "CAM-NANG" ? S.cn : docBy(ma); }
  var viewerToken = 0;
  function openViewer(ma) {
    var d = fileOf(ma); if (!d || !d.file) return;
    closeSheet();
    var token = ++viewerToken;
    var v = $("#viewer"), pages = $("#vPages");
    v.hidden = false; document.body.classList.add("noscroll");
    $("#vTitle").textContent = (d.ma ? d.ma + " – " : "") + d.ten;
    $("#vDl").href = absUrl(d.file); $("#vDl").setAttribute("download", d.file.split("/").pop());
    $("#vPrint").onclick = function () { printDoc(ma); };
    $("#vTab").href = absUrl(d.file);
    pages.innerHTML = '<div class="empty">Đang mở văn bản…</div>';
    loadPdfJs().then(function (lib) { return lib.getDocument(absUrl(d.file)).promise; }).then(function (pdf) {
      if (token !== viewerToken) return;
      pages.innerHTML = "";
      var width = Math.min((pages.clientWidth || 360) - 20, 900);
      var dpr = Math.min(window.devicePixelRatio || 1, pdf.numPages > 12 ? 1.5 : 2);
      var holders = [], jobs = [];
      for (var i = 1; i <= pdf.numPages; i++) jobs.push(pdf.getPage(i));
      return Promise.all(jobs).then(function (list) {
        if (token !== viewerToken) return;
        list.forEach(function (page, idx) {
          var vp0 = page.getViewport({ scale: 1 }), sc = width / vp0.width, vp = page.getViewport({ scale: sc });
          var h = document.createElement("div");
          h.className = "pgwrap"; h.style.width = width + "px"; h.style.height = Math.round(vp.height) + "px"; h.dataset.idx = idx;
          pages.appendChild(h);
          holders.push({ el: h, page: page, vp: vp, done: false });
        });
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (en) {
            if (!en.isIntersecting) return;
            var rec = holders[+en.target.dataset.idx];
            if (!rec || rec.done) return;
            rec.done = true; io.unobserve(en.target);
            var vpr = rec.page.getViewport({ scale: rec.vp.scale * dpr });
            var c = document.createElement("canvas"); c.width = vpr.width; c.height = vpr.height;
            c.style.width = width + "px"; c.style.height = Math.round(rec.vp.height) + "px"; c.className = "pg";
            rec.el.appendChild(c);
            rec.page.render({ canvasContext: c.getContext("2d"), viewport: vpr }).promise
              .then(function () { return rec.page.getAnnotations(); })
              .then(function (anns) {
                anns.forEach(function (an) {
                  if (an.subtype !== "Link") return;
                  var r = rec.vp.convertToViewportRectangle(an.rect);
                  var a = document.createElement("a"); a.className = "lnk";
                  a.style.cssText = "left:" + Math.min(r[0], r[2]) + "px;top:" + Math.min(r[1], r[3]) + "px;width:" + Math.abs(r[2] - r[0]) + "px;height:" + Math.abs(r[3] - r[1]) + "px";
                  if (an.url) { a.href = an.url; a.target = "_blank"; a.rel = "noopener"; }
                  else if (an.dest) {
                    a.href = "#";
                    a.addEventListener("click", function (ev) {
                      ev.preventDefault();
                      var go = function (arr) {
                        if (!arr) return;
                        var ref = arr[0];
                        var pi = typeof ref === "object" ? pdf.getPageIndex(ref) : Promise.resolve(+ref);
                        pi.then(function (n) { var tgt = holders[n]; if (tgt) pages.scrollTo({ top: tgt.el.offsetTop - 8, behavior: "smooth" }); });
                      };
                      if (typeof an.dest === "string") pdf.getDestination(an.dest).then(go); else go(an.dest);
                    });
                  }
                  rec.el.appendChild(a);
                });
              });
          });
        }, { root: pages, rootMargin: "800px 0px" });
        holders.forEach(function (r) { io.observe(r.el); });
      });
    }).catch(function () {
      if (token !== viewerToken) return;
      pages.innerHTML = '<div class="empty">Không hiển thị được trong ứng dụng.<br><a class="btn pri" style="display:inline-block;margin-top:10px;text-decoration:none" href="' + esc(absUrl(d.file)) + '" target="_blank" rel="noopener">Mở file PDF</a></div>';
    });
  }
  function closeViewer() { viewerToken++; $("#viewer").hidden = true; $("#vPages").innerHTML = ""; document.body.classList.remove("noscroll"); }
  function printDoc(ma) {
    var d = fileOf(ma); if (!d || !d.file) return;
    var url = absUrl(d.file);
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "")) { window.open(url, "_blank"); toast("Mở PDF rồi chọn In hoặc Chia sẻ → In"); return; }
    var fr = document.createElement("iframe");
    fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    fr.src = url;
    fr.onload = function () {
      try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { window.open(url, "_blank"); }
      setTimeout(function () { fr.remove(); }, 60000);
    };
    document.body.appendChild(fr);
  }

  init();
})();
