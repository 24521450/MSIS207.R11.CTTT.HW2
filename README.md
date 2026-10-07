# Drum Kit & Beat Recorder — HW2

Ứng dụng trống chạy hoàn toàn trên trình duyệt, viết bằng HTML, CSS và JavaScript module thuần. Có chín pad, phát chồng nhiều tiếng, điều khiển bằng chuột/chạm/bàn phím và ghi rồi phát lại nhịp theo timestamp.

## Chạy ứng dụng

Không cần cài thư viện. Mở terminal tại thư mục dự án và chạy:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Mở `http://127.0.0.1:8000/` trong trình duyệt. Dùng HTTP server vì trình duyệt cần tải JavaScript module và WAV qua cùng origin; không mở `index.html` bằng `file://`.

## Pad và phím mặc định

| Phím | Pad | Âm thanh |
| --- | --- | --- |
| A | Kick | Bass drum |
| S | Snare | Backbeat |
| D | Closed hat | Hi-hat ngắn |
| F | Open hat | Hi-hat ngân dài |
| G | Clap | Hand clap |
| H | Low tom | Tom trầm |
| J | Mid tom | Tom trung |
| K | High tom | Tom cao |
| L | Crash | Cymbal |

Mỗi pad là một button HTML. Có thể dùng click, thao tác chạm, Tab rồi Enter/Space, hoặc phím được hiển thị trên pad. Giữ phím không tạo hit lặp; tổ hợp Ctrl/Alt/Meta và vùng nhập liệu không kích hoạt trống.

## Ghi và phát nhịp

1. Chọn **Ghi nhịp** để bắt đầu một take mới. Take trước được thay bằng bản ghi mới.
2. Chơi các pad. Mỗi hit được lưu theo thứ tự FIFO dưới dạng `{ padId, offsetMs }`; offset tính bằng mili-giây từ lúc bắt đầu ghi bằng đồng hồ monotonic.
3. Chọn **Dừng** để kết thúc ghi và giữ take. Khi phát lại, cùng nút này hủy các nhịp đang chờ và dừng mọi âm thanh đang phát.
4. Chọn **Phát lại** để phát take theo khoảng cách đã ghi. Khoảng im lặng trước nhịp đầu tiên cũng được giữ. Có thể phát lại nhiều lần.
5. Chọn **Xóa bản ghi** khi ở trạng thái idle để xóa take.

Bản ghi chỉ nằm trong bộ nhớ của trang hiện tại; tải lại trang sẽ xóa bản ghi. Không có tài khoản, backend hay xuất file âm thanh.

## Hợp đồng HTML và đổi phím

HTML là nguồn cấu hình duy nhất cho mã pad, phím và đường dẫn âm thanh:

```html
<button
  type="button"
  data-pad-id="kick"
  data-key="a"
  data-sound="audio/samples/kick.wav"
>
```

Để đổi phím trong buổi bảo vệ, sửa `data-key` của một pad, chẳng hạn từ `a` sang `q`, rồi tải lại trang. Bộ điều khiển sẽ cập nhật cả nhãn phím và ánh xạ bàn phím từ HTML; bản ghi dùng `padId` nên không phụ thuộc phím đã dùng lúc ghi.

## Kiến trúc

| Tệp | Trách nhiệm |
| --- | --- |
| `src/main.js` | Điều phối trạng thái idle/recording/playing, nối input, audio, recorder và giao diện. |
| `src/input-controller.js` | Đọc `data-pad-id`, `data-key`, `data-sound`; gộp click và keydown vào một callback. |
| `src/audio-engine.js` | Tạo một `Audio` riêng cho mỗi hit, xử lý lỗi và dừng mọi instance; không truy vấn DOM. |
| `src/beat-recorder.js` | Ghi hàng đợi FIFO `{ padId, offsetMs }` bằng `performance.now()`. |
| `src/beat-player.js` | Lập lịch theo offset tuyệt đối, giữ thứ tự sự kiện, chờ âm thanh cuối cùng và hủy callback. |
| `scripts/generate_samples.py` | Sinh chín mẫu WAV lặp lại được bằng Python standard library. |

Không có inline event handler hay thư viện runtime bên ngoài. Các mẫu âm thanh là mono PCM 16-bit, 22.05 kHz; tổng dung lượng khoảng 223 KB. Chạy `python scripts/generate_samples.py` để tạo lại.

## Kiểm tra

Chạy toàn bộ kiểm tra bằng Node.js:

```powershell
node --test
```

Các kiểm tra dùng Node test runner tích hợp, không cần `npm install`. Chúng bao phủ polyphony, lỗi phát âm thanh, ánh xạ đủ chín phím, lặp phím, modifier, timestamp/FIFO, khoảng nghỉ đầu tiên, phát lại nhiều lần và hủy lịch bằng đồng hồ giả.

Đã rà trực tiếp trong trình duyệt ở chiều rộng 375px: lưới không tràn ngang; click, A/S/L, Enter và Space phát pad; ghi/dừng/phát lại/hủy/xóa cập nhật trạng thái; focus bàn phím còn rõ khi pad sáng. Đã kiểm tra ba mẫu đại diện trong browser và không có lỗi console. Chín WAV đều hợp lệ và tái tạo cho cùng SHA-256 qua hai lần chạy generator.

`npm test` chạy 26 kiểm tra Node.js tích hợp; tất cả đều đạt.

Thời điểm phát thực tế phụ thuộc event loop, tải trang và khả năng của trình duyệt; `setTimeout` cùng HTML audio không đảm bảo độ chính xác sample-level. Recorder giữ timestamp monotonic và beat player lên lịch theo offset đã ghi trong giới hạn của browser.

## Kịch bản bảo vệ trong 3 phút

1. **0:00–0:40:** Đổi `data-key="a"` thành `data-key="q"` trong `index.html`, tải lại, chỉ ra nhãn `Q`; nhấn `Q` phát kick còn `A` không còn ánh xạ.
2. **0:40–1:20:** Mở `src/input-controller.js`; chỉ ra controller đọc cấu hình từ `dataset`, dùng `keydown`/`event.key` và bỏ qua `event.repeat`.
3. **1:20–2:10:** Mở `src/main.js`; lần theo callback kích hoạt đến audio engine và recorder.
4. **2:10–3:00:** Mở `src/beat-recorder.js` để giải thích `{ padId, offsetMs }`, rồi `src/beat-player.js` để chỉ ra FIFO, khoảng nghỉ ban đầu và cơ chế hủy.

Xem [TASK_DECOMPOSITION.md](TASK_DECOMPOSITION.md) để biết các mốc commit và bằng chứng nghiệm thu; xem [project-rules.md](project-rules.md) để biết các ràng buộc kiến trúc.
