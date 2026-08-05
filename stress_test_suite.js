import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * =========================================================================
 * PHYSIVAULT STRESS TEST SUITE - BỘ CÔNG CỤ THỬ TẢI TOÀN DIỆN
 * =========================================================================
 * Cách chạy:
 * 1. Test thực tế (3000 em): k6 run -e TYPE=realistic stress_test_suite.js
 * 2. Test tổng lực (1500 em): k6 run -e TYPE=total_war stress_test_suite.js
 * 3. Test riêng BXH:         k6 run -e TYPE=leaderboard stress_test_suite.js
 * 4. Test riêng PDF:         k6 run -e TYPE=pdf stress_test_suite.js
 * 5. Test chống Spam Vote:   k6 run -e TYPE=vote_lock stress_test_suite.js
 * =========================================================================
 */

const WORKER_BASE = 'https://physivault-proxy.hoaihuy2609.workers.dev';
const SUPABASE_URL = 'https://ndhcwrczwbehyznnxzou.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGN3cmN6d2JlaHl6bm54em91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzk0OTEsImV4cCI6MjA4NzY1NTQ5MX0.-LAbz_xMZdPlHlvyaYrotonX_sKoTLwNMEpHss5fun4';

// Cấu hình các kịch bản (Scenario)
const SCENARIOS = {
    realistic: {
        stages: [
            { duration: '30s', target: 1000 },
            { duration: '1m', target: 2000 },
            { duration: '30s', target: 3000 }, // Ngưỡng trần 3000
            { duration: '20s', target: 0 },
        ],
    },
    total_war: {
        stages: [
            { duration: '10s', target: 500 },
            { duration: '30s', target: 1500 },
            { duration: '10s', target: 0 },
        ],
    },
    leaderboard: {
        stages: [
            { duration: '10s', target: 500 },
            { duration: '20s', target: 1500 },
            { duration: '10s', target: 0 },
        ],
    },
    pdf: {
        stages: [
            { duration: '10s', target: 500 },
            { duration: '20s', target: 1000 },
            { duration: '10s', target: 0 },
        ],
    },
    vote_lock: {
        stages: [
            { duration: '5s', target: 1000 },
            { duration: '15s', target: 1000 },
            { duration: '5s', target: 0 },
        ],
    },
    exam_storm: {
        stages: [
            { duration: '10s', target: 500 },
            { duration: '20s', target: 2000 },
            { duration: '10s', target: 0 },
        ],
    },
    // CHIẾN DỊCH 5.000 EM (CỰC HẠN NHƯNG AN TOÀN)
    safe_5000: {
        stages: [
            { duration: '30s', target: 1000 },
            { duration: '1m', target: 3000 },
            { duration: '30s', target: 5000 }, // ÉP LÊN 5000
            { duration: '1m', target: 5000 }, // GIỮ NGUYÊN 1 PHÚT
            { duration: '30s', target: 0 },
        ],
        // PHANH TAY TỰ ĐỘNG: Nếu lỗi > 5%, dừng k6 ngay lập tức để bảo vệ server
        thresholds: {
            http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '10s' }],
        }
    }
};

export const options = SCENARIOS[__ENV.TYPE] || SCENARIOS.realistic;

// Headers cho Supabase (API key)
const params = {
    headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
    },
};

// Headers cho Cloudflare Worker (giả lập trình duyệt thật)
const workerParams = {
    headers: {
        'Referer': 'https://physivault.vercel.app/',
        'Origin': 'https://physivault.vercel.app',
    },
};
const workerPostParams = {
    headers: {
        'Referer': 'https://physivault.vercel.app/',
        'Origin': 'https://physivault.vercel.app',
        'Content-Type': 'application/json',
    },
};

export default function () {
    const type = __ENV.TYPE || 'realistic';
    const randomSuffix = Math.floor(Math.random() * 9000000 + 1000000);
    const mockPhone = `09${randomSuffix}`;

    if (type === 'realistic' || type === 'safe_5000') {
        // --- KỊCH BẢN HỌC SINH THẬT ---
        http.get(`${WORKER_BASE}/vault-index?grade=12`, workerParams);
        sleep(3);
        http.get(`${WORKER_BASE}/getFile/BQACAgUAAyEGAATn0ptoAAIF_mnBQ9jeGN1RFc6L_enUjpNlVhJUAALBJwACIksRVjF8ovRf6ljOOgQ`, workerParams);
        sleep(7);
        const payload = JSON.stringify({
            p_exam_id: 'suite-test-realistic',
            p_student_phone: mockPhone,
            p_correct_answers: 30, p_total_questions: 40, p_score: 7.5,
            p_raw_results: { q: 'suite' }
        });
        http.post(`${SUPABASE_URL}/rest/v1/rpc/save_student_exam_result`, payload, params);
        http.get(`${WORKER_BASE}/leaderboard?grade=12`, workerParams);
        sleep(5);

    } else if (type === 'total_war') {
        // --- KỊCH BẢN TỔNG LỰC ---
        http.get(`${WORKER_BASE}/vault-index?grade=12`, workerParams);
        http.get(`${WORKER_BASE}/leaderboard?grade=12`, workerParams);
        http.get(`${WORKER_BASE}/getFile/BQACAgUAAyEGAATn0ptoAAIF_mnBQ9jeGN1RFc6L_enUjpNlVhJUAALBJwACIksRVjF8ovRf6ljOOgQ`, workerParams);
        const p = JSON.stringify({ p_exam_id: 'total-war-suite', p_student_phone: mockPhone, p_score: 10 });
        http.post(`${SUPABASE_URL}/rest/v1/rpc/save_student_exam_result`, p, params);
        http.post(`${WORKER_BASE}/vote`, JSON.stringify({ exam_id: 'total-war', part_name: 'I', question_number: 1, student_phone: mockPhone }), workerPostParams);

    } else if (type === 'leaderboard') {
        http.get(`${WORKER_BASE}/leaderboard?grade=12`, workerParams);

    } else if (type === 'pdf') {
        http.get(`${WORKER_BASE}/getFile/BQACAgUAAyEGAATn0ptoAAIF_mnBQ9jeGN1RFc6L_enUjpNlVhJUAALBJwACIksRVjF8ovRf6ljOOgQ`, workerParams);

    } else if (type === 'vote_lock') {
        // Test lock: dùng chung 1 sđt cho tất cả VUs
        const body = JSON.stringify({ exam_id: 'lock-test', part_name: 'I', question_number: 1, student_phone: '0912121212' });
        http.post(`${WORKER_BASE}/vote`, body, workerPostParams);

    } else if (type === 'exam_storm') {
        // Áp lực lớn nhất vào database nộp bài thi thử (gọi RPC submit_exam_result với logic bảo mật thời gian mới)
        const payload = JSON.stringify({
            p_student_phone: '0912121212',
            p_exam_id: 'exam-storm-123',
            p_exam_title: 'Bài Bắn Phá Khảo Sát',
            p_grade: 12,
            p_score: 8.5,
            p_student_name: 'Chiến Binh K6',
            p_correct_answers: 32,
            p_total_questions: 40,
            p_time_taken: 2000
        });
        http.post(`${SUPABASE_URL}/rest/v1/rpc/submit_exam_result`, payload, params);
    }

    sleep(0.5);
}
