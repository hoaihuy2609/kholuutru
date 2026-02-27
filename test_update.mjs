import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ndhcwrczwbehyznnxzou.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGN3cmN6d2JlaHl6bm54em91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzk0OTEsImV4cCI6MjA4NzY1NTQ5MX0.-LAbz_xMZdPlHlvyaYrotonX_sKoTLwNMEpHss5fun4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
    const sdt = '0966399808';
    console.log(`Testing kick for ${sdt}...`);
    const { data, error } = await supabase.from('students').update({ is_active: false }).eq('phone', sdt).select();
    if (error) {
        console.error("Update error:", error);
    } else {
        console.log("Update success, data returned:", data);
    }
}

testUpdate();
