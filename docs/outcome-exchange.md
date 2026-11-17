# Rà yêu cầu cần đạt theo chương

Trong Góc học tập, đăng nhập quản trị, mở chương rồi chọn **Rà YCCĐ bằng JSON**.

1. Chọn **Kiểm tra và chuẩn bị file**. Kiểm tra số câu từng loại, kể cả câu nháp. Nếu có bài không đọc được cấu trúc, giao diện liệt kê rõ trước khi tải.
2. Tải JSON rồi gửi cho AI. File chứa hướng dẫn, toàn bộ câu có cấu trúc trong chương và `result_format` là mẫu kết quả. Không phụ thuộc bộ lọc, bài đang mở hay nhóm lý thuyết/tính toán.
3. Mở **Nhập kết quả** trên cùng trình duyệt đã xuất. Chọn file hoặc dán JSON, chọn **Kiểm tra và xem trước**. Có thể gửi lại một phần câu.
4. Rà YCCĐ cũ/mới, tích xác nhận rồi áp dụng. Nếu có lỗi, toàn bộ lượt cập nhật bị chặn. Kiểm tra trạng thái đồng bộ của kho trước khi tiếp tục lượt khác.
5. **Lịch sử / hoàn tác** cho xem trước và khôi phục YCCĐ cũ. Câu đã được sửa tiếp sẽ chặn hoàn tác để tránh ghi đè. Muốn hoàn tác nhiều đợt chồng nhau, làm từ đợt mới nhất.

## Prompt dùng kèm file xuất

> Đọc file JSON đính kèm. Rà và chuẩn hóa yêu cầu cần đạt theo từng nội dung trong chương, dùng cách diễn đạt nhất quán cho các câu thực sự đánh giá cùng yêu cầu. Đọc đề, đáp án, lời giải, không chỉ dựa vào YCCĐ cũ. Giữ nguyên mức độ hiện có. Với câu Đúng/Sai, xét các mệnh đề và tổng hợp yêu cầu cho cả câu theo cấu trúc hiện tại. Tham chiếu ảnh trong file không đồng nghĩa đã xem ảnh. Câu cần ảnh nhưng chưa xem được, thiếu dữ kiện hoặc chưa chắc cách phân loại thì bỏ khỏi updates và báo riêng để tôi rà, không đoán. Chỉ trả file JSON theo đúng result_format, giữ nguyên schema, export_id, chapter_id và question_id. Mỗi learning_outcomes là một mảng các yêu cầu cụ thể, ngắn gọn, không rỗng. Không gửi lại đề, đáp án, lời giải, ảnh hoặc các trường khác trong updates.

## Phạm vi bảo vệ dữ liệu

- Xuất và xem trước không sửa nội dung câu, không tải/xóa/di chuyển ảnh. File giữ các tham chiếu ảnh, không nhúng bản sao ảnh dạng base64/SVG.
- Mã câu được đối chiếu với lượt xuất đã lưu. Do dữ liệu cũ lưu nhiều câu trong một bài, mã gồm mã bài và vị trí câu; dấu kiểm tra nội dung và cấu trúc chặn trường hợp câu bị chuyển vị trí, xóa, thêm hoặc chỉnh sửa sau lúc xuất.
- Chỉ `learning_outcomes` được thay trong JSON câu, cùng trường thời gian cập nhật của bài. Bản sao câu đầu tại gốc dữ liệu được cập nhật tương ứng. Các trường khác giữ nguyên.
- Lượt nhập được kiểm tra lại trong giao dịch ghi IndexedDB. Thay đổi, lịch sử khôi phục và dấu chờ đồng bộ được ghi cùng giao dịch. Thiếu chỗ lưu hoặc lỗi giao dịch thì không áp dụng từng phần.
- Bản đối chiếu và lịch sử chỉ có trên trình duyệt đã thực hiện, không đồng bộ sang máy khác. Không xóa dữ liệu trang web khi còn cần nhập kết quả/hoàn tác. File lịch sử tải xuống dùng để lưu và đối chiếu, không phải file nhập trực tiếp.
- Việc công bố dùng hàng đợi đồng bộ kho hiện tại. Lưu thành công trên máy chưa có nghĩa đã công bố thành công. Dấu chờ trong IndexedDB cho phép tiếp tục khi mở lại ứng dụng.
- Kho hiện công bố cả bản chụp dữ liệu, chưa có giao dịch chỉnh sửa đồng thời giữa nhiều thiết bị quản trị ở máy chủ. Thực hiện các đợt cập nhật trên một thiết bị; người dùng chỉ xem web vẫn hoạt động bình thường.
- Đợt này chưa thay cấu trúc để lưu YCCĐ riêng từng mệnh đề Đúng/Sai, chưa tự phân loại bằng AI và chưa sửa mức độ nhận thức.

## Kiểm tra

`outcomeExchange.test.ts` kiểm tra giữ nguyên nội dung/ảnh, khôi phục trường YCCĐ ban đầu (kể cả chưa có trường), mã lạ/trùng, câu thay đổi, thứ tự thay đổi và nhập từng phần.

`outcomeExchangeService.test.ts` kiểm tra lưu đồng thời bản cập nhật và lịch sử, lỗi giao dịch không ghi một phần, kiểm tra lại tại lúc ghi và hoàn tác.

`blogSync.test.ts` kiểm tra phục hồi hàng đợi YCCĐ và tránh ghi đè thay đổi cục bộ bằng bản tải về cũ.
