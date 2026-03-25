import http from 'k6/http';
import { check } from 'k6';

const WORKER_BASE = 'https://physivault-proxy.hoaihuy2609.workers.dev';
const SUPABASE_URL = 'https://ndhcwrczwbehyznnxzou.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGN3cmN6d2JlaHl6bm54em91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzk0OTEsImV4cCI6MjA4NzY1NTQ5MX0.-LAbz_xMZdPlHlvyaYrotonX_sKoTLwNMEpHss5fun4';

export const options = {
    // 2.000 NÒNG SÚNG KHÔNG NGỪNG NGHỈ TRONG 60 GIÂY
    stages: [
        { duration: '10s', target: 500 },
        { duration: '10s', target: 2000 }, // ÉP LÊN 2000 ROBOT SPAM
        { duration: '30s', target: 2000 },
        { duration: '10s', target: 0 },
    ],
};

const params = {
    headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
    },
};

export default function () {
    const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
    const mockPhone = `09${randomSuffix}`;

    // --- TỔNG LỰC KHAI HỎA (KHÔNG CÓ LỆNH SLEEP) ---
    
    // 1. Worker Reads (Cache gánh còng lưng)
    http.get(`${WORKER_BASE}/vault-index?grade=12`);
    http.get(`${WORKER_BASE}/leaderboard?grade=12`);
    
    // 2. Edge Binary (Tải PDF liên tục)
    http.get(`${WORKER_BASE}/getFile/BQACAgUAAyEGAATn0ptoAAIF_mnBQ9jeGN1RFc6L_enUjpNlVhJUAALBJwACIksRVjF8ovRf6ljOOgQ`);

    // 3. Database Writes (Thử thách Supabase)
    const p = JSON.stringify({ p_exam_id: 'NUCLEAR-WAR-v1', p_student_phone: mockPhone, p_score: 9.75 });
    http.post(`${SUPABASE_URL}/rest/v1/rpc/save_student_exam_result`, p, params);

    // 4. Edge Anti-Spam (Thử thách Worker Lock)
    const v = JSON.stringify({ exam_id: 'NUCLEAR', part_name: 'II', question_number: 1, student_phone: mockPhone });
    http.post(`${WORKER_BASE}/vote`, v, { headers: { 'Content-Type': 'application/json' } });

    // 5. Direct DB Hits
    const n = JSON.stringify({ notification_id: '9a35f9ae-8f38-444b-afa7-f19e110011f9', student_phone: mockPhone });
    http.post(`${SUPABASE_URL}/rest/v1/notification_fetches`, n, params);

    // TUYỆT ĐỐI KHÔNG SLEEP — SPAM MAX TỐC ĐỘ 100% CÔNG SUẤT MÁY LOCAL
}
