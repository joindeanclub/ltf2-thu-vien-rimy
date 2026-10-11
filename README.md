# Farm LTF2 – Thư viện văn bản và công vụ (GitHub Pages)

Trang web tĩnh cho điện thoại, chỉ để **tra cứu và in**; không ghi lại việc, không lưu dữ liệu người dùng.

| Mục | Dùng để |
|---|---|
| **Thư viện** | Cây thư mục 37 văn bản mẫu (7 nhóm); lọc theo tần suất; xem, in, tải PDF. Thẻ cẩm nang ở đầu |
| **Công vụ** | 19 công vụ có sơ đồ giải quyết từng bước, người làm, điểm quyết định, văn bản bắt buộc/thường dùng/tham chiếu. Có "Tra nhanh: gặp vụ việc gì thì làm gì" |
| **Cẩm nang** | PDF 74 trang có menu bấm được, đã gồm toàn bộ văn bản mẫu |

Văn bản là PDF nên không chỉnh sửa trực tiếp được. Không có hợp đồng thật, số căn cước, số tài khoản, số tiền, tỷ lệ đền bù, mã số doanh nghiệp.

## Đưa lên GitHub Pages (từng bước)
1. Vào https://github.com, đăng nhập. Bấm **+** → **New repository**, đặt tên, chọn **Public**, **Create repository**.
2. **uploading an existing file** → kéo thả `index.html`, `manifest.webmanifest`, `sw.js`, `.nojekyll` và các thư mục `css`, `js`, `data`, `docs`, `icons` → **Commit changes**.
3. **Settings → Pages → Source**: *Deploy from a branch*, Branch `main`, `/ (root)` → **Save**.
4. Sau 1–3 phút có link `https://<tên-github>.github.io/<tên-kho>/`.
5. Thêm vào màn hình chính: iPhone (Safari) Chia sẻ → *Thêm vào MH chính*; Android (Chrome) ⋮ → *Thêm vào màn hình chính*.

## Cập nhật văn bản
1. Sửa bằng bộ dựng trong Drive `Van ban LTF2\_cong-cu`.
2. Dựng **bản công khai** (đặt `LTF2_PUBLIC=1` rồi chạy các `nhom_*.py`, `mau_tc01.py`; tự để trống số tiền, mã số, tỷ lệ), chuyển PDF.
3. Chép PDF vào `docs/<thư mục nhóm>/`; dựng lại cẩm nang bằng `cam_nang.py`, chép vào `docs/00-Cam-nang/`.
4. `python tools\build_data.py`.
5. Đổi `ltf2-v3` thành `ltf2-v4` trong `sw.js` để điện thoại nhận bản mới.
6. Đẩy lên GitHub.

## Chạy thử trên máy tính
```
cd D:\APP\ltf2-quan-ly
python -m http.server 8765
```
Mở http://127.0.0.1:8765/ (không mở trực tiếp file `index.html`).

## Ghi chú
- Xem PDF dùng pdf.js tải từ cdnjs (cần mạng lần đầu; sau đó lưu đệm). Menu trong cẩm nang bấm được cả trong ứng dụng lẫn khi mở bằng trình đọc PDF.
- Trang đặt `noindex` để công cụ tìm kiếm không lập chỉ mục; đó không phải bảo mật.
