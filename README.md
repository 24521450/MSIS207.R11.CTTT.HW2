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

Mỗi pad là một button HTML. Có thể dùng click, thao tác chạm, Tab rồi Enter/Space, hoặc phím được hiển thị trên pad. Phím A–L bỏ qua `event.repeat`. Với button pad, Enter phát một hit ở `keydown`, Space phát một hit ở `keyup`; controller hủy click mặc định của button ngay trên pad để không phát trùng. Thả rồi nhấn lại vẫn tạo hit mới. Tổ hợp Ctrl/Alt/Meta, vùng nhập liệu và phím không ánh xạ không kích hoạt trống.

## Ghi và phát nhịp

1. Chọn **Ghi nhịp** để bắt đầu một take mới. Take trước được thay bằng bản ghi mới.
2. Chơi các pad. Mỗi hit được lưu theo thứ tự FIFO dưới dạng `{ padId, offsetMs }`; offset tính bằng mili-giây từ lúc bắt đầu ghi bằng đồng hồ monotonic.
3. Chọn **Dừng** để kết thúc ghi và giữ take. Nút này cũng khả dụng khi đang chơi tự do mà còn tiếng đang ngân; khi đó nó dừng mọi âm thanh nhưng không thay đổi take. Khi phát lại, Dừng hủy các nhịp đang chờ, ngắt âm thanh hiện tại và giữ bản ghi. Nếu bàn phím đang focus trên Dừng đúng lúc nút trở nên không khả dụng, nút báo `aria-disabled` và giữ focus đến khi người dùng rời nút; sau đó trạng thái native disabled được áp dụng.
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
| `src/input-controller.js` | Đọc `data-pad-id`, `data-key`, `data-sound`; gộp click, phím pad và phím điều khiển vào một callback, chặn click mặc định lặp trên Enter/Space. |
| `src/audio-engine.js` | Tạo một `Audio` riêng cho mỗi hit, xử lý lỗi và dừng mọi instance; không truy vấn DOM. |
| `src/beat-recorder.js` | Ghi hàng đợi FIFO `{ padId, offsetMs }` bằng `performance.now()`. |
| `src/beat-player.js` | Lập lịch theo offset tuyệt đối, giữ thứ tự sự kiện, chờ âm thanh cuối cùng và hủy callback. |
| `scripts/generate_samples.py` | Sinh chín mẫu WAV lặp lại được bằng Python standard library. |

Không có inline event handler hay thư viện runtime bên ngoài. Các mẫu âm thanh là mono PCM 16-bit, 22.05 kHz; tổng dung lượng khoảng 223 KB. Chạy `python scripts/generate_samples.py` để tạo lại.

## Kiểm tra

### Tự động

Chạy bộ kiểm tra bằng Node.js tích hợp:

```powershell
npm test
```

Lần chạy ngày **2026-10-07** đạt **32/32** bài. Bộ kiểm tra dùng `FakeAudio` để xác nhận số instance, lỗi, `activeCount`/`onActiveChange` và dừng; fake timer cho FIFO, offset, phát lại và hủy; `FakeButton`/`FakeDocument` cho ánh xạ và lặp phím. Các mock này kiểm tra logic module, không mô phỏng native click mặc định của trình duyệt. Không cần `npm install` và không thêm dependency vào ứng dụng.

### Trình duyệt

Đã kiểm tra trong phiên ngày **2026-10-07, hoàn tất các lượt kiểm tra trước 13:39 (Asia/Saigon)** trên **Microsoft Edge 154.0.4258.53 (Chromium)**, phục vụ qua HTTP ở `http://127.0.0.1:8000/`. Dùng native `HTMLAudioElement` và button HTML thật. Playwright gửi keyboard down/up đến browser; các keydown lặp quan sát được `event.repeat === true`. Instrumentation chỉ theo dõi play/pause và sự kiện; nó gọi tiếp các phương thức audio native. Không dùng `dispatchEvent` để thay cho kiểm tra Enter/Space.

Đã xác minh:

- A/S/D/F/G/H/J/K/L phát đúng chín tệp WAV. Giữ A, Enter hoặc Space qua nhiều keydown lặp chỉ ghi một hit; thả rồi nhấn lại tạo hit mới. Click chuột tạo một hit.
- Hai instance kick cùng lúc và kick với snare cùng lúc đều ở trạng thái phát; các hit nhanh riêng biệt đều được ghi.
- Ctrl/Alt, phím không ánh xạ và một input đang focus không tạo âm. Đổi HTML `data-key` từ A sang Q rồi reload cập nhật nhãn/ARIA name; A hết ánh xạ và q/Q phát đúng kick.
- Ghi chuỗi kick/snare/crash đo được khoảng cách **283/250/514 ms**; phát lại đo **292/251/507 ms**. Thứ tự FIFO và khoảng im lặng đầu được giữ trong lần chạy này. Phát lại hai lần không tiêu thụ hay nhân bản take.
- Dừng giữa phát lại ngăn các nhịp cũ; dừng rồi phát lại ngay chỉ tạo chuỗi của lượt mới. Dừng khi Crash cuối còn ngân đặt audio về paused và currentTime 0.
- Stop bị khóa khi idle và không còn tiếng; bật khi ghi/phát hoặc còn tiếng chơi tự do. Dừng lúc chơi tự do giữ nguyên take. Tiếng kết thúc tự nhiên khóa Stop lại. Khi chính Stop đang focus, nó báo `aria-disabled` nhưng giữ focus đến khi người dùng rời nút; lúc blur nó chuyển sang native disabled. Thay đổi active count khi Record đang focus không chuyển focus. Mẫu Kick bị chặn có thông báo lỗi và Snare vẫn phát được.
- Tab/Shift+Tab đi qua link và pad với focus ring nhìn thấy; ba viewport 375, 768 và 1440 px không tràn ngang. Luồng bình thường không có lỗi Console, page error hoặc response lỗi.

Lỗi mẫu trong browser được mô phỏng bằng cách chặn request Kick; request lỗi đó là chủ ý, không thuộc kết quả tài nguyên của luồng bình thường. Đã xác minh click chuột và bàn phím trên desktop; chưa có thiết bị cảm ứng hoặc screen reader thật để kiểm tra. Browser test xác nhận trạng thái phát của audio native, không đo chất lượng nghe qua loa/tai nghe.

### Giới hạn và kết quả chưa xác minh

`performance.now()` tạo timestamp monotonic, còn `setTimeout` và HTML Audio chịu ảnh hưởng của event loop, tải máy và buffer âm thanh; chúng không đảm bảo thời gian chính xác đến từng sample. Sai lệch mili-giây nêu trên chỉ là kết quả của một lần chạy Edge, không phải bảo đảm cho mọi máy.

Chín WAV vẫn được sinh bằng `scripts/generate_samples.py`. Lần kiểm tra này không lặp lại phép so sánh SHA-256 của hai lần chạy generator.

## Kịch bản bảo vệ trong 3 phút

1. **0:00–0:40:** Đổi `data-key="a"` thành `data-key="q"` trong `index.html`, tải lại, chỉ ra nhãn `Q`; nhấn `Q` phát kick còn `A` không còn ánh xạ.
2. **0:40–1:20:** Mở `src/input-controller.js`; chỉ ra controller đọc cấu hình từ `dataset`, dùng `keydown`/`event.key` và bỏ qua `event.repeat`.
3. **1:20–2:10:** Mở `src/main.js`; lần theo callback kích hoạt đến audio engine và recorder.
4. **2:10–3:00:** Mở `src/beat-recorder.js` để giải thích `{ padId, offsetMs }`, rồi `src/beat-player.js` để chỉ ra FIFO, khoảng nghỉ ban đầu và cơ chế hủy.

Xem [TASK_DECOMPOSITION.md](TASK_DECOMPOSITION.md) để biết các mốc commit và bằng chứng nghiệm thu; xem [project-rules.md](project-rules.md) để biết các ràng buộc kiến trúc.
