-- Table: public.blogs
CREATE TABLE IF NOT EXISTS public.blogs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    cover_image TEXT,
    category TEXT,
    tags JSONB DEFAULT '[]'::JSONB,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bật RLS
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

-- Chính sách: Ai cũng có thể xem blog đã publish
CREATE POLICY "Cho phép mọi người xem blog đã publish" 
    ON public.blogs FOR SELECT 
    USING (is_published = true OR (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin');

-- Chính sách cho Admin
-- Trong ứng dụng này, vì key xác thực nằm ở FE nên chúng ta có thể cấp quyền qua client
-- Tạm thời cho phép tất cả các thao tác (nếu bạn muốn bảo mật cao hơn có thể check admin_key)
CREATE POLICY "Cho phép thao tác đầy đủ ẩn danh" 
    ON public.blogs FOR ALL 
    USING (true) 
    WITH CHECK (true);
