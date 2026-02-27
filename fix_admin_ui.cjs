const fs = require('fs');
let code = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

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
                const mapped = data.map(row => ({
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
                is_active: false,
                device_limit: 1
            });
            if (error) throw error;

            onShowToast('Đã lưu dữ liệu học viên!', 'success');
            setIsAddModalOpen(false);
            setNewStudent({ sdt: '', name: '', grade: 12 });

            setTimeout(refreshStudents, 500);
        } catch (err) {
            console.error("[Admin] Lỗi khi thêm:", err);
            onShowToast('Lỗi: ' + (err.message || 'Chưa rõ'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };`;
code = code.replace(addRegex, newAdd);

fs.writeFileSync('components/AdminDashboard.tsx', code);
console.log('Fixed Admin UI fully');
