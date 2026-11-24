# Ghi chú dự án — giai đoạn 2 (học kì II, Vật lí 10)

File này giữ các quy ước và phần việc đang dở để làm tiếp, kể cả khi mở phiên làm việc mới.
Không ghi thông tin cá nhân vào đây.

## Quy ước làm việc

- Chỉ thực hiện khi người phụ trách bảo "thực thi" / "làm đi" / "oke". Câu "chỉ trả lời", "chưa thực thi" thì chỉ trả lời.
- Kho câu hỏi chỉ sửa qua trang quản trị (`?full=1`), bằng các tab trong **Rà YCCĐ bằng JSON** của từng chương:
  - **Xuất để rà**: xuất JSON chương (mỗi lần xuất có `export_id` riêng; file sửa phải làm theo đúng lần xuất đó).
  - **Sửa nội dung hàng loạt**: nạp file `physivault.questions.update.v1` (sửa đề, phương án, đáp án, ý Đúng/Sai, lời giải).
  - **Xuất PDF rà câu**: nạp file `physivault.outcomes.print-review.v1` để in các câu cần xem hình. Phải in **trước** khi nạp file sửa của cùng lần xuất, nếu không web báo "đã đổi".
  - **Nhập mức độ**: nạp mức độ và dòng YCCĐ cho câu.
  - **Công khai câu nháp**, **Lịch sử / hoàn tác YCCĐ**.
- Câu và lời giải do AI soạn phải ghi rõ: câu ghi nguồn "Câu do AI hỗ trợ biên soạn"; lời giải kết thúc bằng "(Lời giải do AI hỗ trợ biên soạn.)".
- Giữ nguyên câu chữ SGV và Chương trình GDPT 2018 khi đưa vào dòng YCCĐ; dòng tự đề xuất phải được duyệt.
- Code: kiểm thử (`npx vitest run`) đạt thì tạo PR và gộp vào main.

## Quy tắc phân mức (giảng viên hướng dẫn thống nhất)

| Câu hỏi yêu cầu | Mức |
|---|---|
| Nhắc lại định nghĩa, công thức, đơn vị | Biết |
| Định tính, giải thích hiện tượng, so sánh, biến đổi công thức để suy ra tỉ lệ mà không thay số | Hiểu |
| Thay số vào công thức để tính ra giá trị | Vận dụng |
| Câu trả lời ngắn | Luôn là Vận dụng |

Câu Đúng/Sai gắn mức và dòng YCCĐ cho từng ý a, b, c, d.

## Tình trạng các chương học kì II

| Chương (kho) | SGK | Rà nội dung | Gắn YCCĐ + mức theo bài |
|---|---|---|---|
| g10-ch3 Năng lượng, công, công suất | Bài 23–27 | Xong (409 câu) | Xong (`src/data/lessonLines.ts`) |
| g10-ch4 Động lượng | Bài 28–30 | Xong (170 câu) | **Đang làm** — xem mục dưới |
| g10-ch5 Chuyển động tròn | Bài 31–32 | Xong (98 câu) | Chưa |
| g10-ch6 Biến dạng của vật rắn. Áp suất chất lỏng | Bài 33–34 | Xong (73 câu) | Chưa |

Việc nhỏ còn treo:
- Chương Năng lượng: đổi 2 câu trả lời ngắn đang ở mức Hiểu sang Vận dụng (cho khớp quy tắc và bảng số liệu của đề cương).
- Chương Chuyển động tròn: tên Bài 3 trong kho đang có hai cách viết; chương Biến dạng có tên "BÀI 1 - 2: ĐỊNH LUẬT HOOKE" lệch với các bài khác — cần sửa tay cho thống nhất.

## Quy trình gắn YCCĐ cho một chương

| Bước | Việc |
|---|---|
| 0 | Công khai câu nháp; xuất JSON chương mới nhất |
| 1 | Soạn dòng YCCĐ theo bài × 3 mức (SGV nguyên văn, CT 2018 nguyên văn, dòng đề xuất cần duyệt; dòng thực hành không ra đề trên giấy) |
| 2 | Ghép bài trong kho với bài SGK |
| 3 | Gắn mức và dòng cho từng câu (Đúng/Sai theo từng ý); liệt kê câu lưng chừng để quyết |
| 4 | Nạp qua tab Nhập mức độ |
| 5 | Đưa dòng YCCĐ vào `src/data/lessonLines.ts` và `src/data/programmeRows.ts`, kiểm thử, gộp |
| 6 | Đếm ô ma trận còn thiếu câu; soạn câu bổ sung nếu cần |

## Chương Động lượng — đang dừng ở bước 1 (chờ duyệt)

Bước 0 đã xong (câu nháp đã công khai). Khi làm tiếp, xuất lại JSON chương vì kho có thể đã đổi.

### Ghép bài (bước 2, đã thống nhất)

| SGK | Bài trong kho |
|---|---|
| Bài 28. Động lượng (I. Động lượng; II. Xung lượng của lực) | BÀI 1.1 Động lượng; 1.2 Xung lượng của lực; 1.2 Xác định động lượng của nhiều vật; 1.3 Động lượng của hệ |
| Bài 29. Định luật bảo toàn động lượng (I. Định luật; II. Va chạm đàn hồi và va chạm mềm) | BÀI 2 Định luật bảo toàn động lượng; BÀI 3 Các loại va chạm; 3.1 Va chạm mềm; 3.2 Va chạm đàn hồi |
| Bài 30. Thực hành xác định động lượng của vật trước và sau va chạm (I–IV) | BÀI 4 Thực hành |

### Dòng YCCĐ dự kiến (bước 1)

Nguồn: SGV = mục tiêu bài trong sách giáo viên; CT = YCCĐ Chương trình 2018 (mạch Động lượng); ĐX = đề xuất, **chưa duyệt**.

| Bài | Mức | Dòng | Nguồn |
|---|---|---|---|
| 28 | Biết | Phát biểu được định nghĩa của động lượng và nêu được ý nghĩa vật lí của đại lượng đó. | SGV (trùng ý CT YCCĐ 1) |
| 28 | Biết | Phát biểu và viết được công thức liên hệ giữa lực tác dụng lên vật và tốc độ biến thiên của động lượng (thường được gọi là dạng thứ hai của định luật 2 Newton). | SGV |
| 28 | Hiểu | Rút ra được mối liên hệ giữa lực tổng hợp tác dụng lên vật và tốc độ thay đổi của động lượng (lực tổng hợp tác dụng lên vật là tốc độ thay đổi của động lượng của vật). | CT YCCĐ 4 |
| 28 | Hiểu | Thảo luận để giải thích được một số hiện tượng đơn giản. | CT YCCĐ 6 |
| 28 | Hiểu | Giải thích được động lượng là đại lượng vectơ cùng hướng với vận tốc, phụ thuộc hệ quy chiếu; so sánh được động lượng của các vật. | ĐX 1 |
| 28 | Vận dụng | Vận dụng được công thức tính động lượng của một vật và tổng động lượng của hệ vật trong một số trường hợp đơn giản. | ĐX 2 |
| 28 | Vận dụng | Vận dụng được mối liên hệ giữa xung lượng của lực và độ biến thiên động lượng để tính lực, thời gian tác dụng, độ biến thiên động lượng. | ĐX 3 |
| 29 | Biết | Thực hiện thí nghiệm và thảo luận, phát biểu được định luật bảo toàn động lượng trong hệ kín. | SGV (trùng CT YCCĐ 2) |
| 29 | Biết | Nêu được khái niệm hệ kín; nêu được đặc điểm của va chạm đàn hồi và va chạm mềm. | ĐX 4 |
| 29 | Hiểu | Thực hiện thí nghiệm và thảo luận được sự thay đổi năng lượng trong các trường hợp va chạm đơn giản. | SGV (trùng ý CT YCCĐ 5) |
| 29 | Hiểu | Thảo luận để giải thích được một số hiện tượng đơn giản. | CT YCCĐ 6 |
| 29 | Vận dụng | Vận dụng được định luật bảo toàn trong một số trường hợp đơn giản. | SGV (trùng ý CT YCCĐ 3) |
| 29 | Vận dụng | Vận dụng được định luật bảo toàn động lượng kết hợp với động năng để tính vận tốc sau va chạm và phần động năng hao hụt trong va chạm. | ĐX 5 |
| 29 | Thực hành | Thảo luận để thiết kế phương án hoặc lựa chọn phương án, thực hiện phương án, xác định được tốc độ và đánh giá được động lượng trước và sau va chạm bằng dụng cụ thực hành. | SGV (không ra đề trên giấy) |
| 30 | Thực hành | Thiết kế phương án hoặc lựa chọn phương án và thực hiện phương án xác định động lượng của vật trong hai trường hợp va chạm mềm và va chạm đàn hồi. | SGV |
| 30 | Thực hành | Lắp ráp được dụng cụ thí nghiệm để xác định động lượng của hai vật va chạm. | SGV |
| 30 | Thực hành | Tiến hành thí nghiệm nhanh, chính xác. | SGV |
| 30 | Biết | Nêu được tên và công dụng của các dụng cụ thí nghiệm xác định động lượng. | ĐX 6 |
| 30 | Hiểu | Trình bày được phương án, thứ tự các bước tiến hành thí nghiệm; nêu được nguyên nhân gây sai số và cách hạn chế. | ĐX 7 |
| 30 | Vận dụng | Xác định được tốc độ và đánh giá được động lượng của vật trước và sau va chạm. | CT YCCĐ 7, vế sau |

Kiến thức chương trước có thể cần gắn: vận dụng công thức chuyển động thẳng biến đổi đều; vận tốc tổng hợp; định luật 2 Newton; định luật bảo toàn cơ năng.

### Câu hỏi đang chờ trả lời

| # | Câu hỏi | Đề xuất |
|---|---|---|
| 1 | Duyệt, sửa hay bỏ các dòng ĐX 1–7? | — |
| 2 | CT YCCĐ 6 đặt ở cả Bài 28 và Bài 29, hay chỉ một bài? | Cả hai (xung lượng ở Bài 28; súng giật, phản lực ở Bài 29) |
| 3 | 34 câu giấy của Bài 30: giữ Bài 30 với 3 dòng giấy, hay gộp vào Bài 29? | Giữ Bài 30 |
