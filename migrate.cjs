const fs = require('fs');
let code = fs.readFileSync('src/hooks/useCloudStorage.ts', 'utf8');

if (!code.includes('import { supabase }')) {
    code = "import { supabase } from '../lib/supabase';\n" + code;
}

// 1. Rewrite activateSystem
const activateRegex = /const activateSystem = \(key: string, sdt: string = "", grade\?: number\): boolean => \{([\s\S]*?)return false;\n    \};/;
const newActivate = `const activateSystem = async (key: string, sdt: string = "", grade?: number): Promise<boolean> => {
        const machineId = getMachineId();
        
        try {
            const { data, error } = await supabase
                .from('students')
                .select('activation_key, is_active, machine_id')
                .eq('phone', sdt)
                .single();
                
            if (error || !data) return false;
            if (!data.is_active) return false;
            
            // Allow if machine_id is null (first login) or matches. 
            // If it's null, we could update it, but for now just check key.
            if (data.activation_key === key) {
                // If the student doesn't have a machineId assigned yet, let's claim it
                if (!data.machine_id) {
                    await supabase.from('students').update({ machine_id: machineId }).eq('phone', sdt);
                } else if (data.machine_id !== machineId) {
                    // In a multi-device setup, we'd check device_limit. 
                    // But for this version: Strict 1 machine lock.
                    return false; 
                }
                
                localStorage.setItem(STORAGE_ACTIVATION_KEY, 'true');
                if (sdt) localStorage.setItem('pv_activated_sdt', sdt);
                if (grade) localStorage.setItem(STORAGE_GRADE_KEY, grade.toString());
                setIsActivated(true);
                return true;
            }
        } catch (e) {
            console.error("Lỗi kích hoạt Supabase:", e);
        }
        return false;
    };`;
code = code.replace(activateRegex, newActivate);


// 2. Rewrite fetchLessonsFromGitHub
// Extract GOOGLE_SCRIPT_URL fetching logic
const fetchIndexRegex = /const latestIndexRes = await fetch\(`\$\{GOOGLE_SCRIPT_URL\}\?action=get_latest_index&grade=\$\{grade\}`\);\s+const latestIndexResult = await latestIndexRes\.json\(\);\s+const indexFileId = latestIndexResult\.file_id \|\| localStorage\.getItem\(`pv_sync_file_id_\$\{grade\}`\);/;
const fetchIndexReplacement = `
            let indexFileId = localStorage.getItem(\`pv_sync_file_id_\${grade}\`);
            try {
                const { data, error } = await supabase
                    .from('vault_index')
                    .select('telegram_file_id')
                    .eq('grade', grade)
                    .single();
                if (data && data.telegram_file_id) {
                    indexFileId = data.telegram_file_id;
                }
            } catch (e) {
                console.error("Lỗi lấy index từ Supabase", e);
            }`;
code = code.replace(fetchIndexRegex, fetchIndexReplacement);
code = code.replace(/const GOOGLE_SCRIPT_URL = "https:\/\/script\.google\.com\/macros\/s\/.*?\/exec";\n\s*console\.log\(`\[CloudSync\] Đang hỏi Google cho Lớp \$\{grade\}`\);/, 'console.log(`[CloudSync] Đang hỏi Supabase cho Lớp ${grade}`);');


// 3. Rewrite syncToGitHub
const syncIndexRegex = /const indexRes = await fetch\(`https:\/\/api\.telegram\.org\/bot\$\{TELEGRAM_TOKEN\}\/sendDocument`, \{[\s\S]*?const sheetResult = await sheetRes\.json\(\);\s+if \(!sheetResult\.success\) throw new Error\("Google Sheets từ chối lưu: " \+ \(sheetResult\.error \|\| "Lỗi không xác định"\)\);/;
const syncIndexReplacement = `const indexRes = await fetch(\`https://api.telegram.org/bot\${TELEGRAM_TOKEN}/sendDocument\`, {
            method: 'POST', body: indexForm
        });
        if (!indexRes.ok) { setSyncProgress(0); throw new Error(\`Lỗi upload Index: \${indexRes.statusText}\`); }

        const finalFileId = (await indexRes.json()).result.document.file_id;

        // Lưu vào Supabase thay vì Google Sheets
        const { error: sbError } = await supabase
            .from('vault_index')
            .upsert({ grade, telegram_file_id: finalFileId, updated_at: Date.now() }, { onConflict: 'grade' });
        
        if (sbError) throw new Error("Supabase từ chối lưu: " + sbError.message);`;
code = code.replace(/const GOOGLE_SCRIPT_URL = "https:\/\/script\.google\.com\/macros\/s\/.*?\/exec";\n\s*const indexRes/, 'const indexRes');
code = code.replace(syncIndexRegex, syncIndexReplacement);


// 4. Rewrite verifyAccess
const verifyRegex = /const GOOGLE_SCRIPT_URL = "ht.*?exec";\s*try \{[\s\S]*?\} catch \(e\) \{[\s\S]*?return elapsed > 24 \* 60 \* 60 \* 1000 \? 'offline_expired' : 'ok';\n\s*\}/;
const verifyReplacement = `try {
            const { data, error } = await supabase
                .from('students')
                .select('is_active, machine_id')
                .eq('phone', sdt)
                .single();
                
            if (error || !data || !data.is_active || (data.machine_id && data.machine_id !== machineId)) {
                localStorage.removeItem(STORAGE_ACTIVATION_KEY);
                setIsActivated(false);
                return 'kicked';
            }
            localStorage.setItem('pv_last_check', Date.now().toString());
            return 'ok';
        } catch (e) {
            const lastCheck = localStorage.getItem('pv_last_check');
            if (!lastCheck) return 'offline_expired';
            const elapsed = Date.now() - parseInt(lastCheck);
            return elapsed > 24 * 60 * 60 * 1000 ? 'offline_expired' : 'ok';
        }`;
code = code.replace(verifyRegex, verifyReplacement);


// 5. Rewrite saveExam
const saveExamRegex = /\/\/ Ghi file_id vào GAS \(dùng action riêng cho exam\)[\s\S]*?localStorage\.setItem\('pv_exam_index_file_id', fileId\);/;
const saveExamReplacement = `// Ghi file_id vào Supabase
        const { error: sbError } = await supabase
            .from('vault_index')
            .upsert({ grade: 0, telegram_file_id: fileId, updated_at: Date.now() }, { onConflict: 'grade' });
        if (sbError) throw new Error('Không thể ghi địa chỉ exam lên Supabase');
        
        localStorage.setItem('pv_exam_index_file_id', fileId);`;
code = code.replace(/const GOOGLE_SCRIPT_URL = "https:\/\/script\.google\.com\/macros\/s\/.*?\/exec";\n\s*const content/, 'const content');
code = code.replace(saveExamRegex, saveExamReplacement);

// 6. Rewrite loadExams
const loadExamsRegex = /const GOOGLE_SCRIPT_URL = "https:\/\/script\.google\.com\/macros\/s\/.*?\/exec";\s*const res = await fetch\(`\$\{GOOGLE_SCRIPT_URL\}\?action=get_latest_index&grade=0`\);\s*const result = await res\.json\(\);\s*const fileId = result\.file_id \|\| localStorage\.getItem\('pv_exam_index_file_id'\);\s*if \(!fileId\) return cached \|\| \[\];\s*const dataRes = await fetch\(`\$\{GOOGLE_SCRIPT_URL\}\?action=get_vault_data&file_id=\$\{fileId\}`\);\s*const dataResult = await dataRes\.json\(\);\s*if \(!dataResult\.success\) return cached \|\| \[\];\s*const parsed = JSON\.parse\(xorDeobfuscate\(dataResult\.data\)\);/;
const loadExamsReplacement = `const { data, error } = await supabase
                .from('vault_index')
                .select('telegram_file_id')
                .eq('grade', 0)
                .single();
                
            const fileId = data?.telegram_file_id || localStorage.getItem('pv_exam_index_file_id');
            if (!fileId) return cached || [];

            // Tải file index exam từ Telegram thay vì GAS
            const pathRes = await fetch(\`https://api.telegram.org/bot\${TELEGRAM_TOKEN}/getFile?file_id=\${fileId}\`);
            const pathData = await pathRes.json();
            if (!pathData.ok) return cached || [];
            
            const directUrl = \`https://api.telegram.org/file/bot\${TELEGRAM_TOKEN}/\${pathData.result.file_path}\`;
            const proxyUrl = \`https://api.codetabs.com/v1/proxy/?quest=\${encodeURIComponent(directUrl)}\`;
            
            const fileRes = await fetch(proxyUrl);
            if (!fileRes.ok) return cached || [];
            const arrayBuf = await fileRes.arrayBuffer();
            const indexStr = new TextDecoder().decode(arrayBuf);
            
            const parsed = JSON.parse(xorDeobfuscate(indexStr));`;
code = code.replace(loadExamsRegex, loadExamsReplacement);

fs.writeFileSync('src/hooks/useCloudStorage.ts', code);
console.log('Migration to useCloudStorage.ts applied successfully');
