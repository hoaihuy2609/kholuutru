const fs = require('fs');
const https = require('https');

const CHAT_ID = '-1003889339240';
const PROXY_URL = 'https://physivault-proxy.hoaihuy2609.workers.dev/proxy/sendDocument';
const SUPABASE_URL = 'https://ndhcwrczwbehyznnxzou.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGN3cmN6d2JlaHl6bm54em91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzk0OTEsImV4cCI6MjA4NzY1NTQ5MX0.-LAbz_xMZdPlHlvyaYrotonX_sKoTLwNMEpHss5fun4';

const files = [
  { path: 'C:\\Users\\Acer\\Downloads\\index_grade10_v3.json', grade: 10, name: 'index_grade10_v3.json' },
  { path: 'C:\\Users\\Acer\\Downloads\\index_grade11_v3.json', grade: 11, name: 'index_grade11_v3.json' },
  { path: 'C:\\Users\\Acer\\Downloads\\index_grade12_v3.json', grade: 12, name: 'index_grade12_v3.json' },
  { path: 'C:\\Users\\Acer\\Downloads\\exam_index.bin', grade: 0, name: 'exam_index.bin' }
];

async function uploadToTelegram(filePath, fileName) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            console.log(`[WARN] File missing: ${filePath}`);
            return resolve(null);
        }
        
        const fileData = fs.readFileSync(filePath);
        const boundary = '----WebKitFormBoundary7MAbmH5Z' + Math.random().toString(36).substring(2);
        
        const pre = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${CHAT_ID}\r\n--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
        const post = Buffer.from(`\r\n--${boundary}--\r\n`);
        
        const payload = Buffer.concat([pre, fileData, post]);
        
        const parsedUrl = new URL(PROXY_URL);
        const req = https.request({
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname,
            method: 'POST',
            timeout: 30000,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': payload.length
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.ok && json.result && json.result.document) {
                        resolve(json.result.document.file_id);
                    } else reject(data);
                } catch(e) { reject(e); }
            });
        });
        
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function run() {
    console.log("Starting restore process...");
    for (const f of files) {
        console.log(`Processing ${f.name}...`);
        try {
            const fileId = await uploadToTelegram(f.path, f.name);
            if (fileId) {
                console.log(`Uploaded! New Telegram File ID: ${fileId}`);
                
                // Update Supabase
                const sUrl = new URL(`${SUPABASE_URL}/rest/v1/vault_index?grade=eq.${f.grade}`);
                await new Promise((resolve, reject) => {
                    const sReq = https.request({
                        hostname: sUrl.hostname, 
                        path: `${sUrl.pathname}${sUrl.search}`, 
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${SUPABASE_KEY}`
                        }
                    }, res => res.on('data', ()=>{}).on('end', resolve));
                    sReq.on('error', reject);
                    sReq.write(JSON.stringify({ telegram_file_id: fileId }));
                    sReq.end();
                });
                console.log(`Fixed Supabase for Grade ${f.grade}`);
            }
        } catch(e) {
            console.error(`Error processing ${f.name}:`, e);
        }
    }
    console.log("Done syncing Supabase. Ready for git revert.");
}
run();
