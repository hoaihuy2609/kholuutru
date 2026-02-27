import { createClient } from '@supabase/supabase-js';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzlcTDkj2-GO1mdE6CZ1vaI5pBPWJAGZsChsQxpapw3eO0sKslB0tkNxam8l3Y4G5E8/exec';
const supabaseUrl = 'https://ndhcwrczwbehyznnxzou.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGN3cmN6d2JlaHl6bm54em91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzk0OTEsImV4cCI6MjA4NzY1NTQ5MX0.-LAbz_xMZdPlHlvyaYrotonX_sKoTLwNMEpHss5fun4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
    console.log("1. Đang tải toàn bộ dữ liệu cũ từ Google Sheets để đồng bộ nha...");
    try {
        const res = await fetch(GOOGLE_SCRIPT_URL + '?action=list');
        const json = await res.json();
        if (!json.success || !Array.isArray(json.data)) {
            console.error("❌ Lỗi tải dữ liệu Google Sheets", json);
            return;
        }
        const students = json.data;
        console.log(`✅ Đã tải ${students.length} học sinh. Bắt đầu dùng siêu năng lực đẩy lên Supabase...`);

        let successCount = 0;
        for (const student of students) {
            if (!student.sdt) continue;
            let phoneStr = String(student.sdt).trim();
            // Google Sheets đôi khi sẽ bị mất số 0 ở đầu điện thoại do định dạng Number, nên thêm vào cho chắc
            if (phoneStr.length === 9 && !phoneStr.startsWith('0')) {
                phoneStr = '0' + phoneStr;
            }

            if (!phoneStr) continue;

            const record = {
                phone: phoneStr,
                name: String(student.name || 'Học viên').trim(),
                machine_id: student.machineId || null,
                activation_key: student.key || null,
                is_active: student.status !== 'KICKED',
                grade: student.grade ? parseInt(student.grade) : 12,
                device_limit: 1
            };

            const { error } = await supabase.from('students').upsert(record, { onConflict: 'phone' });
            if (error) {
                console.error(`❌ Lỗi lúc đẩy lên Supabase: ${phoneStr} - ${student.name} ->`, error.message);
            } else {
                console.log(`✅ Đã Sync: ${student.name} (${phoneStr})`);
                successCount++;
            }
        }
        console.log(`\n🎉 BỐT! PHÉP THUẬT LÀM XONG RỒI ĐÓ! Đã Copy ${successCount} / ${students.length} dữ liệu qua Supabase.`);
        console.log(`Bây giờ ông chỉ việc F5 lại trang Web Admin Dashboard là sẽ thấy trọn vẹn đầy đủ nhé!`);
    } catch (e) {
        console.error("❌ Gặp xui xẻo: ", e);
    }
}

migrateData();
