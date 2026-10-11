# Farm LTF2 – Công vụ, thư viện văn bản và việc (GitHub Pages)

Trang web tĩnh cho điện thoại, chạy miễn phí trên GitHub Pages:
- **Thư viện**: cẩm nang vận hành (PDF có menu bấm được) và cây thư mục 37 văn bản mẫu: xem, in, tải PDF; không sửa trực tiếp được.
- **Công vụ**: 19 công vụ có sơ đồ giải quyết từng bước, người làm, điểm quyết định, văn bản đi kèm.
- **Việc**: quản lý đầu việc; dùng chung nhiều người chỉ bằng một link (xem phần Dùng chung).
- **Tổng quan**, **Cài đặt**.

## Nội dung công khai
37 văn bản mẫu liên quan farm (kể cả hợp đồng lao động mẫu NS-01), cẩm nang, tên công vụ, việc mẫu.
**Đã loại:** các hợp đồng thật (hợp tác kinh doanh, thuê đất, nội bộ), số căn cước, số tài khoản, tổng mức và số tiền từng hạng mục, tỷ lệ đền bù, mã số doanh nghiệp.
Bản Word gốc đầy đủ nằm trên Google Drive, không đưa lên GitHub.

## A. Đưa lên GitHub Pages (từng bước)
1. Vào https://github.com và đăng nhập (chưa có thì **Sign up**).
2. Bấm dấu **+** góc trên phải → **New repository**. Tên kho khó đoán, ví dụ `ltf2-thu-vien-7x3k`. Chọn **Public**. Bấm **Create repository**.
3. Trong kho vừa tạo bấm **uploading an existing file**.
4. Mở thư mục `D:\APP\ltf2-quan-ly`, chọn **các mục sau** rồi kéo thả vào trình duyệt: `index.html`, `manifest.webmanifest`, `sw.js`, `.nojekyll`, thư mục `css`, `js`, `data`, `docs`, `icons`. (Không cần `tools`, `backend`, `README.md`.) Nếu GitHub không nhận cả thư mục, tải từng thư mục một.
5. Kéo xuống cuối, bấm **Commit changes**.
6. Vào **Settings → Pages**. Mục **Build and deployment → Source** chọn *Deploy from a branch*; **Branch** chọn `main`, thư mục `/ (root)`; bấm **Save**.
7. Chờ 1–3 phút, tải lại trang Settings → Pages sẽ thấy dòng *Your site is live at* `https://<tên-github>.github.io/<tên-kho>/`. Đó là link thư viện.
8. Điện thoại: **iPhone (Safari)** Chia sẻ → *Thêm vào MH chính*; **Android (Chrome)** ⋮ → *Thêm vào màn hình chính*.

## B. Dùng chung nhiều người chỉ cần link (làm một lần)
Việc được lưu chung ở một file JSON trong Google Drive của chủ trại, qua Google Apps Script (miễn phí).
1. Vào https://script.google.com, đăng nhập tài khoản Google của người quản lý, bấm **New project**.
2. Xóa mã mặc định, dán **toàn bộ** nội dung file `backend/Code.gs`.
3. Bấm biểu tượng bánh răng **Project Settings** (bên trái) → **Script Properties** → **Add script property**: Property `KEY`, Value là một chuỗi bí mật dài (ví dụ 24 ký tự chữ và số, tự đặt). **Save script properties**.
4. Bấm **Deploy → New deployment** → biểu tượng bánh răng chọn **Web app**. **Execute as**: *Me*. **Who has access**: *Anyone*. Bấm **Deploy**, cấp quyền khi được hỏi (Authorize access → chọn tài khoản → Advanced → Go to … → Allow). Sao chép **Web app URL**.
5. Mở trang thư viện → **Cài đặt → Dùng chung nhiều người**: dán **URL** và **Mã dùng chung** (đúng chuỗi `KEY`) → **Lưu** → **Đồng bộ ngay**.
6. Bấm **Sao chép link dùng chung** và gửi link đó cho người cần dùng. Link có dạng `https://…/#k=<mã>`; họ chỉ cần mở link, máy tự nhớ mã và đồng bộ.
7. Để người mở link không phải dán URL kho: sửa `data/config.json` thành `{"sync_url": "<Web app URL>"}` rồi tải lên GitHub (Add file → Upload files → Commit).

Lưu ý: ai có link dùng chung đều xem và sửa được danh sách việc. Muốn đổi mã: đổi `KEY` ở Script Properties, deploy lại, gửi link mới. Sửa `Code.gs` sau này: Deploy → Manage deployments → bút chì → Version: New version → Deploy.

## Cập nhật văn bản
1. Sửa văn bản bằng bộ dựng trong Drive `Van ban LTF2\_cong-cu`.
2. Dựng **bản công khai**: đặt biến môi trường `LTF2_PUBLIC=1` rồi chạy các script `nhom_*.py` và `mau_tc01.py` (tự để trống số tiền, mã số, tỷ lệ), chuyển sang PDF.
3. Chép PDF vào `docs/<thư mục nhóm>/`; dựng lại cẩm nang bằng `cam_nang.py` rồi chép vào `docs/00-Cam-nang/`.
4. Chạy `python tools\build_data.py`.
5. Đổi `ltf2-v2` thành `ltf2-v3` trong `sw.js` để điện thoại nhận bản mới.
6. Tải các file đã đổi lên GitHub (Upload files → ghi đè → Commit).

## Chạy thử trên máy tính
```
cd D:\APP\ltf2-quan-ly
python -m http.server 8765
```
Mở http://127.0.0.1:8765/ (không mở trực tiếp file `index.html`).

## Ghi chú
- Xem PDF dùng thư viện pdf.js tải từ cdnjs (cần mạng lần đầu; sau đó được lưu đệm). Menu trong cẩm nang bấm được cả trong ứng dụng lẫn khi mở bằng trình đọc PDF.
- Trang đặt `noindex` để công cụ tìm kiếm không lập chỉ mục; đó không phải bảo mật. Đừng ghi số tiền, số tài khoản, số căn cước vào tên việc hay ghi chú.
