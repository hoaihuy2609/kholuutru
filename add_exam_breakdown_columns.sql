-- CHẠY SQL NÀY TRONG SUPABASE SQL EDITOR ĐỂ HỖ TRỢ HIỂN THỊ CHI TIẾT KẾT QUẢ
-- Dashboard -> SQL Editor -> New Query -> Run

ALTER TABLE exam_results 
ADD COLUMN IF NOT EXISTS part_scores jsonb,
ADD COLUMN IF NOT EXISTS tf_breakdown jsonb;

-- Nhớ reload postgrest sau khi chạy (thường Supabase tự làm, nhưng cho chắc)
NOTIFY pgrst, 'reload schema';
