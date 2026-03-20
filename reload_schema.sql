-- Reload PostgREST schema cache để nhận các hàm RPC mới
NOTIFY pgrst, 'reload schema';
