CREATE TABLE public.question_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id TEXT NOT NULL,
    student_phone TEXT NOT NULL,
    part_name TEXT NOT NULL,
    question_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Mỗi học sinh chỉ được vote tối đa 1 lần cho 1 câu cụ thể của 1 đề
    UNIQUE(exam_id, student_phone, part_name, question_number)
);

ALTER TABLE public.question_votes ENABLE ROW LEVEL SECURITY;

-- Ai cũng có thể xem kết quả vote
CREATE POLICY "Anyone can select votes"
    ON public.question_votes FOR SELECT
    USING (true);

-- Cho phép insert (ứng dụng sẽ tự kiểm soát user)
CREATE POLICY "Users can insert their own votes"
    ON public.question_votes FOR INSERT
    WITH CHECK (true);
