import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ndhcwrczwbehyznnxzou.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGN3cmN6d2JlaHl6bm54em91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NDUwMTEsImV4cCI6MjA4OTE4NTAxMX0.-LAbz_xMZdPlHIvyaYrotonX_sKoTLwNMEpHss5fun4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Testing insert...');
    const { data, error } = await supabase.from('students').insert({
        phone: '0999999999',
        name: 'Test Name',
        activation_key: '',
        is_active: true,
        grade: 12
    });
    console.log('Error:', error);
    console.log('Data:', data);

    if (!error) {
        await supabase.from('students').delete().eq('phone', '0999999999');
    }
}

test();
