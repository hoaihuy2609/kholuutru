import http from 'k6/http';
import { check, sleep } from 'k6';

const TARGET_URL = __ENV.TARGET_URL || 'http://localhost:4173';

export const options = {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
        { duration: '5s', target: 50 },     // Khởi động
        { duration: '10s', target: 500 },    // Lên 500
        { duration: '15s', target: 1000 },   // Lên 1000
        { duration: '15s', target: 2000 },   // Lên 2000 
        { duration: '15s', target: 3000 },   // Lên 3000
        { duration: '15s', target: 4000 },   // Lên 4000
        { duration: '15s', target: 5000 },   // Mức cực đại 5000 (bắn phá)
        { duration: '20s', target: 5000 },   // Giữ mức 5000
        { duration: '10s', target: 0 },      // Kết thúc
    ],
    thresholds: {
        http_req_duration: ['p(95)<1000'], // 95% request dưới 1s
        http_req_failed: ['rate<0.05'],    // Tỉ lệ lỗi < 5%
    },
};

export default function () {
    let res = http.get(TARGET_URL);
    
    check(res, {
        'status is 200': (r) => r.status === 200,
    });

    // Bắn phá ác liệt: chỉ nghỉ 0.1 giây (tương đương 1 user gửi 10 requests / giây)
    sleep(0.1);
}
