-- RPC: chatbot ghi machine_id cho học sinh (SECURITY DEFINER bypass RLS)
CREATE OR REPLACE FUNCTION admin_set_machine_id(
  p_phone      text,
  p_machine_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE students
  SET machine_id = p_machine_id
  WHERE phone = p_phone
    AND (machine_id IS NULL OR machine_id = '');
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_machine_id(text, text) TO anon;

NOTIFY pgrst, 'reload schema';
