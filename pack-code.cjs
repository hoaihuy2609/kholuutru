const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['.git', 'node_modules', 'dist', '.vscode', '.agent'];
const ALLOWED_EXTS = ['.ts', '.tsx', '.sql', '.css', '.html', '.json'];

// Hàm vẽ sơ đồ cây thư mục (File Tree)
function generateTree(dirPath, prefix = '', isLast = true) {
    let tree = '';
    const items = fs.readdirSync(dirPath);
    
    // Lọc thư mục ẩn và thư mục rác
    const filteredItems = items.filter(item => !IGNORE_DIRS.includes(item));
    
    filteredItems.forEach((item, index) => {
        const fullPath = path.join(dirPath, item);
        const isDir = fs.statSync(fullPath).isDirectory();
        const ext = path.extname(item);
        
        // Bỏ qua các file không liên quan
        if (!isDir && !ALLOWED_EXTS.includes(ext) && !['package.json', 'tsconfig.json'].includes(item)) {
            return;
        }

        const isLastItem = index === filteredItems.length - 1;
        const pointer = isLastItem ? '└── ' : '├── ';
        tree += `${prefix}${pointer}${item}\n`;

        if (isDir) {
            const nextPrefix = prefix + (isLastItem ? '    ' : '│   ');
            tree += generateTree(fullPath, nextPrefix, isLastItem);
        }
    });

    return tree;
}

// Bắt đầu gộp file
function main() {
    const args = process.argv.slice(2);
    let outputContent = `# CẤU TRÚC DỰ ÁN (FILE TREE)\n\`\`\`text\nphysivault/\n${generateTree(__dirname)}\`\`\`\n\n`;

    if (args.length === 0) {
        console.log("⚠️ Cảnh báo: Bạn chưa truyền file nào vào. Script chỉ tạo sơ đồ cây dự án.");
        console.log("👉 Cách dùng: node pack-code.cjs <duong_dan_file_1> <duong_dan_file_2>");
        console.log("👉 Ví dụ: node pack-code.cjs components/StatsPanel.tsx types.ts");
    } else {
        outputContent += `# MÃ NGUỒN CÁC FILE ĐANG XỬ LÝ\n`;
        let successCount = 0;
        
        args.forEach(filePath => {
            const fullPath = path.resolve(__dirname, filePath);
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
                const content = fs.readFileSync(fullPath, 'utf8');
                const ext = path.extname(fullPath).substring(1);
                const language = ext === 'tsx' ? 'tsx' : ext === 'ts' ? 'typescript' : ext;

                outputContent += `\n>>>>> FILE: ${relativePath}\n\`\`\`${language}\n${content}\n\`\`\`\n`;
                successCount++;
            } else {
                console.log(`❌ Lỗi: Không tìm thấy file "${filePath}"`);
            }
        });
        console.log(`✅ Đã gộp thành công cấu trúc tree và ${successCount} files vào: context.md`);
    }

    fs.writeFileSync(path.join(__dirname, 'context.md'), outputContent, 'utf8');
}

main();
