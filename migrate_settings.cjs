const fs = require('fs');
let code = fs.readFileSync('components/SettingsModal.tsx', 'utf8');

if (!code.includes('import { supabase }')) {
    code = "import { supabase } from '../src/lib/supabase';\n" + code;
}

// Rewrite handleGenerateKey
const handleGenerateKeyRegex = /const handleGenerateKey = async \(\) => \{([\s\S]*?)setAdminTargetSdt\(''\);\n    \};/;
const newHandleGenerateKey = `const handleGenerateKey = async () => {
        const targetId = adminTargetId.trim();
        const name = studentName.trim();
        const sdt = adminTargetSdt.trim();
        if (!targetId) { onShowToast('Vui lòng nhập Mã máy của học sinh', 'warning'); return; }
        if (!sdt) { onShowToast('Vui lòng nhập SĐT học sinh để tạo mã chính xác!', 'warning'); return; }
        
        const key = generateActivationKey(targetId, sdt);
        setGeneratedKey(key);
        
        try {
            // Thay vì Push lên GAS, Push thẳng lên Supabase
            const { error } = await supabase.from('students').upsert({
                phone: sdt,
                name: name || 'Học sinh tự tạo',
                machine_id: targetId,
                activation_key: key,
                is_active: true,
                grade: studentGrade,
                device_limit: 1 // default
            }, { onConflict: 'phone' });
            
            if (error) throw error;
            onShowToast('Đã tạo mã và đồng bộ lên Supabase!', 'success');
        } catch (e: any) {
            console.error(e);
            onShowToast('Lỗi đồng bộ lên Supabase: ' + e.message, 'error');
        }

        const filteredHistory = activationHistory.filter(h => h.id !== targetId);
        const newHistory = [{ id: targetId, name: name || 'Học sinh mới', key, date: Date.now() }, ...filteredHistory].slice(0, 50);
        setActivationHistory(newHistory);
        localStorage.setItem('pv_activation_history', JSON.stringify(newHistory));
        setStudentName('');
        setAdminTargetSdt('');
    };`;
code = code.replace(handleGenerateKeyRegex, newHandleGenerateKey);

// Modify handleActivate
const handleActivateRegex = /if \(onActivateSystem\(/;
const newHandleActivate = `if (await onActivateSystem(`;
code = code.replace(/onActivateSystem\(key, sdt, studentGrade\)/, 'await onActivateSystem(key, sdt, studentGrade)');
if (!code.match(/async const handleActivate/)) {
    code = code.replace(/const handleActivate = async \(\) => \{/, 'const handleActivate = async () => {');
}

fs.writeFileSync('components/SettingsModal.tsx', code);
console.log('Migration settingsModal applied successfully');
