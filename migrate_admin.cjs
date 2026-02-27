const fs = require('fs');
let code = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

if (!code.includes('import { supabase }')) {
    code = "import { supabase } from '../src/lib/supabase';\n" + code;
}

// 1. Rewrite refreshStudents
const refreshRegex = /const refreshStudents = async \(\) => \{([\s\S]*?)setLoading\(false\);\n\s*\}\n\s*\};/;
const newRefresh = `const refreshStudents = async () => {
        setLoading(true);
        console.log("[Admin] Đang tải danh sách học sinh từ Supabase");
        try {
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("[Admin] Lỗi query Supabase:", error);
                setStudents([]);
            } else if (data) {
                // Map to match the existing Student interface roughly
                const mapped: Student[] = data.map(row => ({
                    sdt: row.phone,
                    name: row.name,
                    machineId: row.machine_id || '',
                    key: row.activation_key || '',
                    status: row.is_active ? 'active' : 'KICKED',
                    grade: row.grade,
                }));
                setStudents(mapped);
            }
        } catch (err) {
            console.error("[Admin] Lỗi kết nối Supabase:", err);
            setStudents([]);
        } finally {
            setLoading(false);
        }
    };`;
code = code.replace(refreshRegex, newRefresh);

// 2. Rewrite handleAddStudent
const addRegex = /const handleAddStudent = async \(e: React\.FormEvent\) => \{([\s\S]*?)setIsSubmitting\(false\);\n\s*\}\n\s*\};/;
const newAdd = `const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStudent.sdt || !newStudent.name) return;
        setIsSubmitting(true);
        console.log("[Admin] Đang thêm học viên:", newStudent);

        try {
            const { error } = await supabase.from('students').insert({
                phone: newStudent.sdt,
                name: newStudent.name,
                grade: newStudent.grade,
                is_active: false, // Wait until they generate key
                device_limit: 1
            });
            if (error) throw error;

            onShowToast('Đã lưu dữ liệu học viên!', 'success');
            setIsAddModalOpen(false);
            setNewStudent({ sdt: '', name: '', grade: 12 });

            setTimeout(refreshStudents, 500);
        } catch (err: any) {
            console.error("[Admin] Lỗi khi thêm:", err);
            onShowToast('Lỗi: ' + err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };`;
code = code.replace(addRegex, newAdd);

// 3. Rewrite handleDeleteStudent
const deleteRegex = /const handleDeleteStudent = async \(sdt: string\) => \{([\s\S]*?)\};/;
const newDelete = `const handleDeleteStudent = async (sdt: string) => {
        if (!window.confirm(\`Bạn có chắc muốn xóa học viên \${sdt} không?\`)) return;
        try {
            const { error } = await supabase.from('students').delete().eq('phone', sdt);
            if (error) throw error;
            onShowToast('Đã xóa học viên!', 'warning');
            setTimeout(refreshStudents, 500);
        } catch (e: any) { onShowToast('Lỗi khi xóa học viên: ' + e.message, 'error'); }
    };`;
code = code.replace(deleteRegex, newDelete);

// 4. Rewrite handleKickStudent
const kickRegex = /const handleKickStudent = async \(sdt: string, name: string\) => \{([\s\S]*?)\};/;
const newKick = `const handleKickStudent = async (sdt: string, name: string) => {
        if (!window.confirm(\`Bạn có chắc muốn KICK học viên "\${name}" (\${sdt}) không?\\n\\nHọc viên sẽ không thể truy cập tài liệu nữa.\`)) return;
        try {
            const { error } = await supabase.from('students').update({ is_active: false }).eq('phone', sdt);
            if (error) throw error;
            onShowToast(\`Đã kick học viên \${name}!\`, 'success');
            setTimeout(refreshStudents, 500);
        } catch (e:any) { onShowToast('Lỗi khi kick học viên: ' + e.message, 'error'); }
    };`;
code = code.replace(kickRegex, newKick);

// 5. Rewrite handleUnkickStudent
const unkickRegex = /const handleUnkickStudent = async \(sdt: string, name: string\) => \{([\s\S]*?)\};/;
const newUnkick = `const handleUnkickStudent = async (sdt: string, name: string) => {
        if (!window.confirm(\`Mở khóa cho học viên "\${name}" (\${sdt})?\\n\\nHọc viên sẽ cần kích hoạt lại từ đầu.\`)) return;
        try {
            const { error } = await supabase.from('students').update({ is_active: true, machine_id: null }).eq('phone', sdt);
            if (error) throw error;
            onShowToast(\`Đã mở khóa cho \${name}!\`, 'success');
            setTimeout(refreshStudents, 500);
        } catch (e: any) { onShowToast('Lỗi khi mở khóa học viên: ' + e.message, 'error'); }
    };`;
code = code.replace(unkickRegex, newUnkick);

// Replace changing string
code = code.replace("Đang nạp dữ liệu từ Google Sheets", "Đang nạp dữ liệu từ Supabase");

fs.writeFileSync('components/AdminDashboard.tsx', code);
console.log('Migration AdminDashboard.tsx applied successfully');
