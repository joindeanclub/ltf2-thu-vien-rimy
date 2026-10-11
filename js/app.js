/* Farm LTF2 – việc, công vụ và thư viện văn bản (trang tĩnh trên GitHub Pages; dữ liệu việc lưu trên máy). */
(function () {
  "use strict";

  var LS_TASKS = "ltf2.tasks.v1";
  var LS_SET = "ltf2.settings.v1";
  var LS_TOMB = "ltf2.tomb.v1";
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  var PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  var STATUS = [
    { k: "can_lam", t: "Cần làm", ico: "" },
    { k: "dang_lam", t: "Đang làm", ico: "▶" },
    { k: "cho_duyet", t: "Chờ duyệt", ico: "…" },
    { k: "xong", t: "Xong", ico: "✓" }
  ];
  var DEFAULT_PEOPLE = ["Ông Trung", "Ông Thủy", "Ông Tùng", "Ông Trình", "Kế toán farm", "Kỹ thuật farm", "Thủ kho", "Bảo vệ"];
  var TAN = ["Hằng ngày", "Hằng tuần", "Hằng tháng", "Mỗi lần", "Khi có sự cố", "Một lần"];

  var S = {
    docs: [], nhom: [], cv: [], cats: [], tasks: [], settings: {},
    tomb: [], sync: { url: "", key: "", last: "", busy: false }, cn: null,
    tab: "viec", fStatus: "mo", fNhom: "", fNguoi: "", q: "",
    dNhom: "", dTan: "", dq: "", cq: "", cCat: "", cvOpen: "", open: {}
  };

  // ---------- Tiện ích ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function uid() { return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function toISO(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function parseISO(s) { if (!s) return null; var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmt(s) { if (!s) return ""; var p = s.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function daysTo(s) { var d = parseISO(s); return d ? Math.round((d - today()) / 86400000) : null; }
  function toast(m) { var t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2300); }
  function nhomName(k) { if (!k || k === "KHAC") return "Khác"; for (var i = 0; i < S.nhom.length; i++) if (S.nhom[i].ma === k) return S.nhom[i].ten; return k; }
  function docBy(ma) { for (var i = 0; i < S.docs.length; i++) if (S.docs[i].ma === ma) return S.docs[i]; return null; }
  function cvBy(id) { for (var i = 0; i < S.cv.length; i++) if (S.cv[i].id === id) return S.cv[i]; return null; }
  function stName(k) { for (var i = 0; i < STATUS.length; i++) if (STATUS[i].k === k) return STATUS[i].t; return k; }
  function people() { return (S.settings.people && S.settings.people.length) ? S.settings.people : DEFAULT_PEOPLE; }
  function saveTasks() {
    if (!lsSet(LS_TASKS, S.tasks) || !lsSet(LS_TOMB, S.tomb)) toast("Không lưu được trên máy này (trình duyệt chặn bộ nhớ)");
    scheduleSync();
  }
  function saveSettings() { lsSet(LS_SET, S.settings); }
  function driveSearch(q) { return "https://drive.google.com/drive/search?q=" + encodeURIComponent(q); }
  function absUrl(rel) { return new URL(rel.split("/").map(encodeURIComponent).join("/"), location.href).href; }

  function loadJSON(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }
  function init() {
    S.settings = lsGet(LS_SET, {});
    if (S.settings.theme) document.documentElement.setAttribute("data-theme", S.settings.theme);
    S.tomb = lsGet(LS_TOMB, []);
    var m = /[#&]k=([^&]+)/.exec(location.hash || "");
    if (m) { S.settings.syncKey = decodeURIComponent(m[1]); saveSettings(); try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
    Promise.all([loadJSON("data/documents.json"), loadJSON("data/workflows.json"), loadJSON("data/tasks.seed.json"),
                 loadJSON("data/config.json").catch(function () { return {}; })]).then(function (r) {
      S.sync.url = S.settings.syncUrl || (r[3] && r[3].sync_url) || "";
      S.sync.key = S.settings.syncKey || "";
      S.docs = r[0].van_ban; S.nhom = r[0].nhom; S.cn = r[0].cam_nang || null; S.cv = r[1].cong_vu; S.cats = r[1].cats;
      var local = lsGet(LS_TASKS, null);
      S.tasks = Array.isArray(local) ? local : r[2].tasks;
      if (!Array.isArray(local)) saveTasks();
      bind(); render();
      syncNow(false);
      setInterval(function () { if (!document.hidden) syncNow(false); }, 45000);
      if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
    }).catch(function () {
      $("#view").innerHTML = '<div class="empty">Không tải được dữ liệu. Hãy mở trang qua địa chỉ GitHub Pages (không mở trực tiếp file).</div>';
    });
  }

  // ---------- Điều hướng ----------
  function bind() {
    document.querySelectorAll(".tabs button").forEach(function (b) {
      b.addEventListener("click", function () { S.tab = b.getAttribute("data-tab"); S.cvOpen = ""; render(); window.scrollTo(0, 0); });
    });
    $("#fab").addEventListener("click", function () { taskSheet(null); });
    $("#scrim").addEventListener("click", closeSheet);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (!$("#viewer").hidden) closeViewer(); else closeSheet(); } });
    $("#view").addEventListener("click", onViewClick);
    $("#view").addEventListener("input", onViewInput);
    $("#sheet").addEventListener("click", onSheetClick);
    $("#vClose").onclick = closeViewer;
  }
  function render() {
    document.querySelectorAll(".tabs button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === S.tab); });
    $("#fab").hidden = S.tab !== "viec";
    var v = $("#view"), sub = "";
    if (S.tab === "viec") { v.innerHTML = viewViec(); sub = "Danh sách đầu việc"; }
    else if (S.tab === "congvu") { v.innerHTML = S.cvOpen ? viewCvDetail(S.cvOpen) : viewCongVu(); sub = S.cvOpen ? "Sơ đồ giải quyết công vụ" : "Công vụ và văn bản đi kèm"; }
    else if (S.tab === "thuvien") { v.innerHTML = viewThuVien(); sub = "Thư viện văn bản"; }
    else if (S.tab === "tongquan") { v.innerHTML = viewTongQuan(); sub = "Tổng quan"; }
    else { v.innerHTML = viewCaiDat(); sub = "Cài đặt"; }
    $("#sub").textContent = sub;
  }
  function chip(label, on, attr, count) {
    return '<button class="chip' + (on ? " on" : "") + '" ' + attr + ">" + esc(label) + (count != null ? "<small>" + count + "</small>" : "") + "</button>";
  }
  function docChip(ma) {
    var d = docBy(ma);
    return '<span class="tag doc" data-doc="' + esc(ma) + '" title="' + esc(d ? d.ten : ma) + '">' + esc(ma) + "</span>";
  }

  // ---------- Việc ----------
  function filteredTasks() {
    var q = S.q.trim().toLowerCase();
    return S.tasks.filter(function (t) {
      if (S.fStatus === "mo" && t.trang_thai === "xong") return false;
      if (S.fStatus && S.fStatus !== "mo" && t.trang_thai !== S.fStatus) return false;
      if (S.fNhom && (t.nhom || "KHAC") !== S.fNhom) return false;
      if (S.fNguoi && t.nguoi !== S.fNguoi) return false;
      if (q && (t.tieu_de + " " + (t.ghi_chu || "") + " " + (t.van_ban || []).join(" ") + " " + (t.nguoi || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      var ad = a.trang_thai === "xong" ? 1 : 0, bd = b.trang_thai === "xong" ? 1 : 0;
      if (ad !== bd) return ad - bd;
      var ha = a.han || "9999-99-99", hb = b.han || "9999-99-99";
      if (ha !== hb) return ha < hb ? -1 : 1;
      return (a.uu_tien || 2) - (b.uu_tien || 2);
    });
  }
  function viewViec() {
    var cnt = { mo: 0 };
    STATUS.forEach(function (s) { cnt[s.k] = 0; });
    S.tasks.forEach(function (t) { cnt[t.trang_thai]++; if (t.trang_thai !== "xong") cnt.mo++; });
    var h = '<input class="search" id="q" type="search" placeholder="Tìm việc, mã văn bản, người…" value="' + esc(S.q) + '">';
    h += '<div class="chips">' + chip("Đang mở", S.fStatus === "mo", 'data-fs="mo"', cnt.mo);
    STATUS.forEach(function (s) { h += chip(s.t, S.fStatus === s.k, 'data-fs="' + s.k + '"', cnt[s.k]); });
    h += chip("Tất cả", S.fStatus === "", 'data-fs=""', S.tasks.length) + "</div>";
    h += '<div class="chips">' + chip("Mọi nhóm", !S.fNhom, 'data-fn=""');
    S.nhom.forEach(function (n) { h += chip(n.ten, S.fNhom === n.ma, 'data-fn="' + n.ma + '"'); });
    h += chip("Khác", S.fNhom === "KHAC", 'data-fn="KHAC"') + "</div>";
    h += '<div class="chips">' + chip("Mọi người", !S.fNguoi, 'data-fp=""');
    people().forEach(function (p) { h += chip(p, S.fNguoi === p, 'data-fp="' + esc(p) + '"'); });
    h += "</div>";
    var list = filteredTasks();
    if (!list.length) h += '<div class="empty">Không có việc nào khớp bộ lọc.<br>Bấm ＋ để thêm việc.</div>';
    list.forEach(function (t) { h += taskCard(t); });
    return h;
  }
  function taskCard(t) {
    var done = t.trang_thai === "xong";
    var st = STATUS.filter(function (s) { return s.k === t.trang_thai; })[0] || STATUS[0];
    var due = "";
    if (t.han) {
      var dl = daysTo(t.han), cls = "", txt = fmt(t.han);
      if (!done) {
        if (dl < 0) { cls = "due"; txt += " · quá " + (-dl) + " ngày"; }
        else if (dl <= 3) { cls = "soon"; txt += dl === 0 ? " · hôm nay" : " · còn " + dl + " ngày"; }
      }
      due = '<span class="tag ' + cls + '">⏰ ' + esc(txt) + "</span>";
    }
    var docs = (t.van_ban || []).map(docChip).join("");
    return '<article class="card task' + (done ? " done" : "") + '">' +
      '<button class="st s-' + t.trang_thai + '" data-cycle="' + t.id + '" aria-label="Đổi trạng thái: ' + esc(st.t) + '">' + esc(st.ico) + "</button>" +
      '<div class="body" data-edit="' + t.id + '"><h3>' + esc(t.tieu_de) + "</h3>" +
      '<div class="meta"><span class="tag">' + esc(nhomName(t.nhom)) + '</span><span class="tag">' + esc(st.t) + "</span>" +
      (t.uu_tien === 1 ? '<span class="tag pri1">Ưu tiên cao</span>' : "") + due +
      (t.nguoi ? '<span class="tag">👤 ' + esc(t.nguoi) + "</span>" : "") + docs + "</div></div></article>";
  }

  // ---------- Công vụ ----------
  function viewCongVu() {
    var q = S.cq.trim().toLowerCase();
    var h = '<input class="search" id="cq" type="search" placeholder="Tìm công vụ: mua sắm, nghiệm thu, thả giống…" value="' + esc(S.cq) + '">';
    h += '<div class="chips">' + chip("Tất cả", !S.cCat, 'data-cc=""');
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
    if (!any) h += '<div class="empty">Không có công vụ nào khớp.</div>';
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
        h += '<li class="node dec"><span class="n">?</span><div class="box"><strong>' + esc(b.qd.hoi) + '</strong>' +
          '<div class="br"><span class="yes">Có</span><p>' + esc(b.qd.co) + '</p></div>' +
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
    h += '<div class="btns"><button class="btn pri" data-cv-task="' + w.id + '">Tạo việc theo công vụ này</button></div>';
    return h;
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
    var any = false, searching = !!(q || S.dTan || S.dNhom);
    if (S.cn && !searching) h += '<article class="card cn-card"><span class="cn-ico">📘</span><div><h3>' + esc(S.cn.ten) + "</h3><p>" + esc(S.cn.mo_ta) + "</p>" +
      '<div class="btns"><button class="btn pri" data-view="CAM-NANG">Xem cẩm nang</button><a class="btn" style="text-align:center;text-decoration:none" href="' + esc(absUrl(S.cn.file)) + '" target="_blank" rel="noopener">Mở bằng trình đọc PDF</a></div></div></article>';
    h += '<div class="tree">';
    S.nhom.forEach(function (n) {
      if (S.dNhom && S.dNhom !== n.ma) return;
      var list = S.docs.filter(function (d) {
        if (d.nhom !== n.ma) return false;
        if (!tanMatch(d.tan_suat, S.dTan)) return false;
        if (q && (d.ma + " " + d.ten + " " + d.dung_khi + " " + d.tan_suat).toLowerCase().indexOf(q) < 0) return false;
        return true;
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
            '<div><h3>' + esc(d.ten) + "</h3><p>" + esc(d.tan_suat) + " · " + esc(d.kho) + ", " + d.trang + " trang</p></div><span class='pdf'>PDF</span></article>";
        });
        h += "</div>";
      }
      h += "</section>";
    });
    h += "</div>";
    if (!any) h += '<div class="empty">Không có văn bản nào khớp.</div>';
    h += '<p class="note">Văn bản ở dạng PDF để xem, in, lưu: không chỉnh sửa trực tiếp được. Không chứa hợp đồng, số căn cước hay số liệu tài chính.</p>';
    return h;
  }

  // ---------- Tổng quan ----------
  function viewTongQuan() {
    var open = S.tasks.filter(function (t) { return t.trang_thai !== "xong"; });
    var over = open.filter(function (t) { return t.han && daysTo(t.han) < 0; });
    var soon = open.filter(function (t) { return t.han && daysTo(t.han) >= 0 && daysTo(t.han) <= 7; });
    var done = S.tasks.length - open.length;
    var h = '<div class="stat-grid"><div class="stat"><b>' + open.length + "</b><span>Việc đang mở</span></div>" +
      '<div class="stat bad"><b>' + over.length + "</b><span>Quá hạn</span></div>" +
      '<div class="stat warn"><b>' + soon.length + "</b><span>Đến hạn 7 ngày</span></div>" +
      '<div class="stat ok"><b>' + done + "</b><span>Đã xong</span></div></div>";
    var risk = over.concat(soon).sort(function (a, b) { return a.han < b.han ? -1 : 1; });
    h += '<h2 class="sec">Cần chú ý</h2>' + (risk.length ? risk.map(taskCard).join("") : '<div class="empty">Không có việc quá hạn hoặc sắp đến hạn.</div>');
    h += '<h2 class="sec">Tiến độ theo nhóm</h2><div class="card">';
    S.nhom.map(function (n) { return { k: n.ma, t: n.ten }; }).concat([{ k: "KHAC", t: "Khác" }]).forEach(function (g) {
      var all = S.tasks.filter(function (t) { return (t.nhom || "KHAC") === g.k; });
      if (!all.length) return;
      var dn = all.filter(function (t) { return t.trang_thai === "xong"; }).length;
      h += '<div class="row"><span>' + esc(g.t) + "</span><span>" + dn + "/" + all.length + '</span></div><div class="bar" style="margin-bottom:12px"><i style="width:' + Math.round(dn * 100 / all.length) + '%"></i></div>';
    });
    h += "</div>";
    h += '<h2 class="sec">Biểu mẫu dùng hằng ngày</h2>';
    S.docs.filter(function (d) { return d.tan_suat === "Hằng ngày"; }).forEach(function (d) {
      h += '<article class="card doc" data-doc="' + esc(d.ma) + '"><span class="code">' + esc(d.ma) + "</span><div><h3>" + esc(d.ten) + "</h3><p>" + esc(d.dung_khi) + "</p></div></article>";
    });
    return h;
  }

  // ---------- Cài đặt ----------
  function viewCaiDat() {
    var st = S.settings, gh = st.gh || {};
    var h = '<div class="card"><strong>Dữ liệu việc</strong><p class="note">Việc được lưu <b>trên chính điện thoại này</b>. Muốn dùng chung nhiều máy: xuất file rồi nhập ở máy kia, hoặc bật đồng bộ GitHub bên dưới.</p>' +
      '<div class="btns"><button class="btn" id="bExport">Xuất file JSON</button><label class="btn" style="text-align:center">Nhập file<input id="bImport" type="file" accept="application/json" hidden></label></div>' +
      '<div class="btns"><button class="btn" id="bShare">Chia sẻ / gửi Zalo</button><button class="btn danger" id="bReset">Về dữ liệu mẫu</button></div></div>';
    h += '<div class="card"><strong>Người phụ trách</strong><div class="field" style="margin-top:8px"><label>Mỗi người một dòng</label><textarea id="people">' + esc(people().join("\n")) + '</textarea></div><div class="btns"><button class="btn" id="bPeople">Lưu danh sách</button></div></div>';
    h += '<div class="card"><strong>Mở bản Word gốc trên Google Drive</strong><p class="note">Chỉ dành cho người quản lý văn bản. Dán link thư mục từng nhóm để mở thẳng; để trống thì tìm theo mã trong Drive đang đăng nhập.</p>';
    S.nhom.forEach(function (n) {
      h += '<div class="field"><label>' + esc(n.ten) + '</label><input data-folder="' + n.ma + '" type="url" placeholder="https://drive.google.com/drive/folders/..." value="' + esc((st.folders || {})[n.ma] || "") + '"></div>';
    });
    h += "</div>";
    h += syncCard();
    h += '<div class="card"><strong>Giao diện</strong><div class="chips" style="margin-top:8px">' + chip("Theo máy", !st.theme, 'data-theme=""') + chip("Sáng", st.theme === "light", 'data-theme="light"') + chip("Tối", st.theme === "dark", 'data-theme="dark"') + "</div></div>";
    h += '<p class="note">Farm LTF2 · Công ty Cổ phần Công nghệ Nông nghiệp LITECH · phiên bản 2.0</p>';
    return h;
  }

  // ---------- Sự kiện ----------
  function onViewInput(e) {
    var t = e.target;
    if (t.id === "q") { S.q = t.value; keepFocus("q", viewViec); }
    else if (t.id === "dq") { S.dq = t.value; keepFocus("dq", viewThuVien); }
    else if (t.id === "cq") { S.cq = t.value; keepFocus("cq", viewCongVu); }
  }
  function keepFocus(id, fn) {
    var pos = $("#" + id).selectionStart;
    $("#view").innerHTML = fn();
    var el = $("#" + id); el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {}
  }
  function onViewClick(e) {
    var el = e.target.closest("[data-fs],[data-fn],[data-fp],[data-dn],[data-dt],[data-cc],[data-cycle],[data-edit],[data-doc],[data-cv],[data-cv-back],[data-cv-task],[data-fold],[data-theme],[data-view],button,label");
    if (!el) return;
    var d = el.dataset;
    if (d.fs !== undefined) { S.fStatus = d.fs; return render(); }
    if (d.fn !== undefined) { S.fNhom = d.fn; return render(); }
    if (d.fp !== undefined) { S.fNguoi = d.fp; return render(); }
    if (d.dn !== undefined) { S.dNhom = d.dn; return render(); }
    if (d.dt !== undefined) { S.dTan = d.dt; return render(); }
    if (d.cc !== undefined) { S.cCat = d.cc; return render(); }
    if (d.view) return openViewer(d.view);
    if (d.fold) { S.open[d.fold] = !S.open[d.fold]; return render(); }
    if (d.cycle) return cycle(d.cycle);
    if (d.cvBack) { S.cvOpen = ""; render(); return window.scrollTo(0, 0); }
    if (d.cvTask) return taskFromCv(d.cvTask);
    if (d.doc) return docSheet(d.doc);
    if (d.cv) { S.cvOpen = d.cv; render(); return window.scrollTo(0, 0); }
    if (d.edit) return taskSheet(d.edit);
    if (d.theme !== undefined) { S.settings.theme = d.theme; saveSettings(); if (d.theme) document.documentElement.setAttribute("data-theme", d.theme); else document.documentElement.removeAttribute("data-theme"); return render(); }
    switch (el.id) {
      case "bExport": return exportJSON();
      case "bShare": return shareJSON();
      case "bReset": return resetData();
      case "bPeople": return savePeople();
      case "syncSave": return syncSaveCfg();
      case "syncNow": return syncNow(true);
      case "syncLink": return syncShareLink();
    }
  }
  function onSheetClick(e) {
    var el = e.target.closest("[data-doc],[data-open-cv],[data-view],[data-print],[data-newtask]");
    if (!el) return;
    var d = el.dataset;
    if (d.view) return openViewer(d.view);
    if (d.print) return printDoc(d.print);
    if (d.openCv) { closeSheet(); S.tab = "congvu"; S.cvOpen = d.openCv; render(); return window.scrollTo(0, 0); }
    if (d.doc) return docSheet(d.doc);
  }
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "bImport" && t.files && t.files[0]) importJSON(t.files[0]);
    if (t.dataset && t.dataset.folder) {
      S.settings.folders = S.settings.folders || {};
      S.settings.folders[t.dataset.folder] = t.value.trim(); saveSettings(); toast("Đã lưu link thư mục");
    }
  });
  function cycle(id) {
    var t = S.tasks.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    var order = ["can_lam", "dang_lam", "cho_duyet", "xong"];
    t.trang_thai = order[(order.indexOf(t.trang_thai) + 1) % order.length];
    t.sua = new Date().toISOString(); saveTasks(); render();
    toast(t.trang_thai === "xong" ? "Đã xong ✓" : "Trạng thái: " + stName(t.trang_thai));
  }

  // ---------- Bottom sheet ----------
  function openSheet(html) { $("#sheet").innerHTML = html; $("#sheetWrap").hidden = false; $("#sheet").scrollTop = 0; }
  function closeSheet() { $("#sheetWrap").hidden = true; $("#sheet").innerHTML = ""; }
  function opt(list, sel, blank) {
    var h = blank ? '<option value="">' + esc(blank) + "</option>" : "";
    list.forEach(function (o) {
      var v = typeof o === "string" ? o : o.v, l = typeof o === "string" ? o : o.l;
      h += '<option value="' + esc(v) + '"' + (v === sel ? " selected" : "") + ">" + esc(l) + "</option>";
    });
    return h;
  }
  function taskSheet(id, preset) {
    var t = id ? S.tasks.filter(function (x) { return x.id === id; })[0] : null;
    var v = t || preset || {};
    var nhomOpts = S.nhom.map(function (n) { return { v: n.ma, l: n.ten }; }).concat([{ v: "KHAC", l: "Khác" }]);
    var stOpts = STATUS.map(function (s) { return { v: s.k, l: s.t }; });
    var priOpts = [{ v: "1", l: "Cao" }, { v: "2", l: "Vừa" }, { v: "3", l: "Thấp" }];
    var docOpts = S.docs.map(function (d) { return '<option value="' + esc(d.ma) + '"' + ((v.van_ban || []).indexOf(d.ma) >= 0 ? " selected" : "") + ">" + esc(d.ma + " – " + d.ten) + "</option>"; }).join("");
    openSheet("<h2>" + (t ? "Sửa việc" : "Thêm việc") + "</h2>" +
      '<div class="field"><label>Việc cần làm</label><input id="fTitle" value="' + esc(v.tieu_de || "") + '" placeholder="Ví dụ: Ký phụ lục góp vốn đợt 1"></div>' +
      '<div class="two"><div class="field"><label>Nhóm</label><select id="fNhom">' + opt(nhomOpts, v.nhom || "KHAC") + "</select></div>" +
      '<div class="field"><label>Trạng thái</label><select id="fSt">' + opt(stOpts, v.trang_thai || "can_lam") + "</select></div></div>" +
      '<div class="two"><div class="field"><label>Hạn</label><input id="fHan" type="date" value="' + esc(v.han || "") + '"></div>' +
      '<div class="field"><label>Ưu tiên</label><select id="fPri">' + opt(priOpts, String(v.uu_tien || 2)) + "</select></div></div>" +
      '<div class="field"><label>Người phụ trách</label><select id="fNguoi">' + opt(people(), v.nguoi || "", "— chưa giao —") + "</select></div>" +
      '<div class="field"><label>Văn bản liên quan (chọn nhiều)</label><select id="fDocs" multiple size="5">' + docOpts + "</select></div>" +
      '<div class="field"><label>Ghi chú (đừng ghi số tiền, số tài khoản, số căn cước)</label><textarea id="fNote">' + esc(v.ghi_chu || "") + "</textarea></div>" +
      '<div class="btns">' + (t ? '<button class="btn danger" id="fDel">Xóa</button>' : "") + '<button class="btn" id="fCancel">Hủy</button><button class="btn pri" id="fSave">Lưu</button></div>');
    $("#fCancel").onclick = closeSheet;
    if (t) $("#fDel").onclick = function () {
      if (confirm("Xóa việc này?")) { S.tasks = S.tasks.filter(function (x) { return x.id !== t.id; }); S.tomb.push({ id: t.id, xoa: true, sua: new Date().toISOString() }); saveTasks(); closeSheet(); render(); toast("Đã xóa"); }
    };
    $("#fSave").onclick = function () {
      var title = $("#fTitle").value.trim();
      if (!title) { toast("Nhập nội dung việc"); return; }
      var sel = Array.prototype.slice.call($("#fDocs").selectedOptions).map(function (o) { return o.value; });
      var obj = t || { id: uid(), tao: new Date().toISOString() };
      obj.tieu_de = title; obj.nhom = $("#fNhom").value; obj.trang_thai = $("#fSt").value;
      obj.han = $("#fHan").value; obj.uu_tien = +$("#fPri").value; obj.nguoi = $("#fNguoi").value;
      obj.van_ban = sel; obj.ghi_chu = $("#fNote").value.trim(); obj.sua = new Date().toISOString();
      if (!t) S.tasks.unshift(obj);
      saveTasks(); closeSheet(); S.tab = "viec"; S.cvOpen = ""; render(); toast("Đã lưu");
    };
  }
  function taskFromCv(id) {
    var w = cvBy(id); if (!w) return;
    var nhom = { TC: "TC", CT: "DA", NS: "NS", VH: "VH", KH: "KH", AN: "AN" }[w.cat] || "KHAC";
    taskSheet(null, { tieu_de: "Công vụ: " + w.ten, nhom: nhom, van_ban: w.bat_buoc.slice(), uu_tien: 2, trang_thai: "can_lam",
      ghi_chu: "Các bước: " + w.buoc.filter(function (b) { return !b.qd; }).map(function (b, i) { return (i + 1) + ". " + b.ten; }).join("; ") });
  }
  function docSheet(ma) {
    var d = docBy(ma); if (!d) return;
    var folder = (S.settings.folders || {})[d.nhom];
    var linked = S.tasks.filter(function (t) { return (t.van_ban || []).indexOf(ma) >= 0; });
    var cvs = (d.cong_vu || []).map(cvBy).filter(Boolean);
    var ltxt = linked.length ? linked.map(function (t) { return '<div class="row"><span>' + esc(t.tieu_de) + "</span><span>" + esc(stName(t.trang_thai)) + "</span></div>"; }).join("")
      : '<p class="note">Chưa có việc nào gắn với văn bản này.</p>';
    var ctxt = cvs.length ? cvs.map(function (w) { return '<button class="chip" data-open-cv="' + w.id + '">' + esc(w.id.replace("CV-", "") + " · " + w.ten) + "</button>"; }).join("") : "";
    var hasFile = !!d.file;
    openSheet("<h2>" + esc(d.ma) + " – " + esc(d.ten) + "</h2>" +
      '<dl class="kv"><dt>Nhóm</dt><dd>' + esc(nhomName(d.nhom)) + "</dd><dt>Dùng khi</dt><dd>" + esc(d.dung_khi) + "</dd>" +
      "<dt>Tần suất</dt><dd>" + esc(d.tan_suat) + "</dd><dt>Khổ giấy</dt><dd>A4 " + esc(d.kho.toLowerCase()) + ", " + d.trang + " trang</dd>" +
      "<dt>Người ký</dt><dd>" + esc(d.ky) + "</dd></dl>" +
      '<div class="btns"><button class="btn pri" data-view="' + esc(ma) + '"' + (hasFile ? "" : " disabled") + ">Xem văn bản</button>" +
      '<button class="btn" data-print="' + esc(ma) + '"' + (hasFile ? "" : " disabled") + ">In</button>" +
      (hasFile ? '<a class="btn" style="text-align:center;text-decoration:none" href="' + esc(absUrl(d.file)) + '" download>Tải PDF</a>' : "") + "</div>" +
      (ctxt ? '<h3 class="mini">Dùng trong công vụ</h3><div class="chips wrap">' + ctxt + "</div>" : "") +
      '<h3 class="mini">Việc liên quan</h3>' + ltxt +
      '<div class="btns"><button class="btn" id="dClose">Đóng</button><button class="btn pri" id="dNew">Tạo việc từ văn bản</button></div>' +
      '<p class="small mute" style="margin-top:12px">Bản Word gốc: ' +
      '<a target="_blank" rel="noopener" href="' + esc(folder || driveSearch("LTF2-" + d.ma)) + '">mở trên Drive</a> (chỉ người quản lý văn bản).</p>');
    $("#dClose").onclick = closeSheet;
    $("#dNew").onclick = function () {
      taskSheet(null, { tieu_de: "Lập / điền " + d.ma + " – " + d.ten, nhom: d.nhom, van_ban: [d.ma], uu_tien: 2, trang_thai: "can_lam" });
    };
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
          h.className = "pgwrap"; h.style.width = width + "px"; h.style.height = Math.round(vp.height) + "px";
          h.dataset.idx = idx;
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
            rec.page.render({ canvasContext: c.getContext("2d"), viewport: vpr }).promise.then(function () {
              return rec.page.getAnnotations();
            }).then(function (anns) {
              anns.forEach(function (an) {
                if (an.subtype !== "Link") return;
                var r = rec.vp.convertToViewportRectangle(an.rect);
                var x = Math.min(r[0], r[2]), y = Math.min(r[1], r[3]), w = Math.abs(r[2] - r[0]), hh = Math.abs(r[3] - r[1]);
                var a = document.createElement("a"); a.className = "lnk";
                a.style.cssText = "left:" + x + "px;top:" + y + "px;width:" + w + "px;height:" + hh + "px";
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
        pages._holders = holders;
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

  // ---------- Xuất, nhập ----------
  function payload() { return JSON.stringify({ v: 1, xuat: new Date().toISOString(), tasks: S.tasks }, null, 1); }
  function exportJSON() {
    var blob = new Blob([payload()], { type: "application/json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "ltf2-viec-" + toISO(new Date()) + ".json"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast("Đã xuất file");
  }
  function shareJSON() {
    var f = new File([payload()], "ltf2-viec-" + toISO(new Date()) + ".json", { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: "Việc Farm LTF2" }).catch(function () {});
    else exportJSON();
  }
  function importJSON(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var o = JSON.parse(r.result);
        if (!o || !Array.isArray(o.tasks)) throw new Error("sai định dạng");
        if (!confirm("Thay toàn bộ việc hiện tại bằng " + o.tasks.length + " việc trong file?")) return;
        S.tasks = o.tasks; saveTasks(); S.tab = "viec"; render(); toast("Đã nhập " + o.tasks.length + " việc");
      } catch (e) { toast("File không hợp lệ"); }
    };
    r.readAsText(file);
  }
  function resetData() {
    if (!confirm("Xóa việc hiện tại và quay về danh sách mẫu?")) return;
    loadJSON("data/tasks.seed.json").then(function (s) { S.tasks = s.tasks; S.tomb = []; saveTasks(); S.tab = "viec"; render(); toast("Đã về dữ liệu mẫu"); });
  }
  function savePeople() {
    S.settings.people = $("#people").value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    saveSettings(); toast("Đã lưu danh sách");
  }


  // ---------- Dùng chung nhiều người qua một link (Google Apps Script + Drive của chủ trại) ----------
  function mergeTasks(local, remote, tomb) {
    var map = {}, dead = {};
    function take(o) {
      if (!o || !o.id) return;
      var cur = map[o.id];
      if (o.xoa) { if (!dead[o.id] || dead[o.id].sua < o.sua) dead[o.id] = o; return; }
      if (!cur || (cur.sua || "") < (o.sua || "")) map[o.id] = o;
    }
    (remote || []).forEach(take); (local || []).forEach(take); (tomb || []).forEach(take);
    var live = [], tombs = [];
    Object.keys(map).forEach(function (id) {
      if (dead[id] && dead[id].sua >= (map[id].sua || "")) return;
      live.push(map[id]);
    });
    Object.keys(dead).forEach(function (id) { tombs.push(dead[id]); });
    live.sort(function (a, b) { return (b.tao || "") < (a.tao || "") ? -1 : 1; });
    return { live: live, tomb: tombs };
  }
  var syncTimer = null;
  function scheduleSync() {
    if (!S.sync || !S.sync.url || !S.sync.key) return;
    clearTimeout(syncTimer); syncTimer = setTimeout(function () { syncNow(false); }, 1500);
  }
  function syncNow(show) {
    var c = S.sync;
    if (!c.url || !c.key) { if (show) toast("Chưa cấu hình kho dùng chung"); return; }
    if (c.busy) return;
    c.busy = true;
    fetch(c.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ key: c.key, tasks: S.tasks.concat(S.tomb) }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || j.error || !Array.isArray(j.tasks)) throw new Error(j && j.error ? j.error : "phản hồi lỗi");
        var m = mergeTasks(S.tasks, j.tasks, S.tomb);
        S.tasks = m.live; S.tomb = m.tomb;
        lsSet(LS_TASKS, S.tasks); lsSet(LS_TOMB, S.tomb);
        c.last = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        if (!$("#sheetWrap").hidden || !$("#viewer").hidden) { /* không vẽ lại khi đang mở hộp thoại */ } else if (S.tab !== "caidat") render();
        if (show) toast("Đã đồng bộ lúc " + c.last);
      })
      .catch(function (e) { if (show) toast("Không đồng bộ được: " + e.message); })
      .then(function () { c.busy = false; });
  }
  function syncCard() {
    var c = S.sync;
    return '<div class="card"><strong>Dùng chung nhiều người (qua link)</strong>' +
      '<p class="note">Việc được lưu chung ở một kho riêng (Google Apps Script, dùng Drive của chủ trại). Ai mở <b>link dùng chung</b> đều thấy và sửa cùng một danh sách. ' +
      (c.url && c.key ? "Đang bật. Lần đồng bộ cuối: " + esc(c.last || "chưa") + "." : "Chưa bật: dán địa chỉ kho và mã bên dưới (xem hướng dẫn trong README).") + "</p>" +
      '<div class="field"><label>Địa chỉ kho (URL Web app)</label><input id="syUrl" type="url" placeholder="https://script.google.com/macros/s/.../exec" value="' + esc(S.settings.syncUrl || c.url || "") + '"></div>' +
      '<div class="field"><label>Mã dùng chung</label><input id="syKey" type="password" autocomplete="off" value="' + esc(S.settings.syncKey || "") + '"></div>' +
      '<div class="btns"><button class="btn" id="syncSave">Lưu</button><button class="btn pri" id="syncNow">Đồng bộ ngay</button></div>' +
      '<div class="btns"><button class="btn" id="syncLink">Sao chép link dùng chung</button></div></div>';
  }
  function syncSaveCfg() {
    S.settings.syncUrl = $("#syUrl").value.trim(); S.settings.syncKey = $("#syKey").value.trim();
    S.sync.url = S.settings.syncUrl || S.sync.url; S.sync.key = S.settings.syncKey; saveSettings();
    toast("Đã lưu"); syncNow(true);
  }
  function syncShareLink() {
    if (!S.settings.syncKey) { toast("Chưa có mã dùng chung"); return; }
    var link = location.origin + location.pathname + "#k=" + encodeURIComponent(S.settings.syncKey);
    function ok() { toast("Đã sao chép link. Gửi link này cho người cùng dùng."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(ok, function () { prompt("Sao chép link:", link); });
    else prompt("Sao chép link:", link);
  }

  init();
})();
