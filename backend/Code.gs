/**
 * Kho dùng chung cho "Farm LTF2 – việc và văn bản".
 * Chạy trên Google Apps Script của chủ trại; dữ liệu lưu trong 1 file JSON ở Google Drive của người triển khai.
 * Ai có link dùng chung (kèm mã) đều đọc và sửa cùng một danh sách việc.
 *
 * Cài đặt (xem README): Project Settings → Script properties → KEY = <chuỗi bí mật dài>.
 */
var FILE_NAME = "ltf2-viec-dung-chung.json";

function fileRef_() {
  var it = DriveApp.getFilesByName(FILE_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFile(FILE_NAME, '{"tasks":[]}', MimeType.PLAIN_TEXT);
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function key_() {
  return PropertiesService.getScriptProperties().getProperty("KEY");
}

function merge_(a, b) {
  var map = {}, dead = {};
  function take(o) {
    if (!o || !o.id) return;
    if (o.xoa) {
      if (!dead[o.id] || (dead[o.id].sua || "") < (o.sua || "")) dead[o.id] = o;
      return;
    }
    var cur = map[o.id];
    if (!cur || (cur.sua || "") < (o.sua || "")) map[o.id] = o;
  }
  (a || []).forEach(take);
  (b || []).forEach(take);
  var out = [];
  Object.keys(map).forEach(function (id) {
    if (dead[id] && (dead[id].sua || "") >= (map[id].sua || "")) return;
    out.push(map[id]);
  });
  Object.keys(dead).forEach(function (id) { out.push(dead[id]); });
  return out;
}

function doGet(e) {
  var k = key_();
  if (!k || !e || !e.parameter || e.parameter.key !== k) return out_({ error: "forbidden" });
  return out_(JSON.parse(fileRef_().getBlob().getDataAsString()));
}

function doPost(e) {
  var k = key_();
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ error: "bad request" }); }
  if (!k || body.key !== k) return out_({ error: "forbidden" });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var f = fileRef_();
    var cur = JSON.parse(f.getBlob().getDataAsString());
    var merged = merge_(cur.tasks, body.tasks);
    // giữ dấu xóa tối đa 60 ngày để các máy cũ kịp đồng bộ
    var cutoff = new Date(Date.now() - 60 * 86400000).toISOString();
    merged = merged.filter(function (t) { return !t.xoa || (t.sua || "") >= cutoff; });
    f.setContent(JSON.stringify({ tasks: merged, updated: new Date().toISOString() }));
    return out_({ tasks: merged });
  } finally {
    lock.releaseLock();
  }
}
