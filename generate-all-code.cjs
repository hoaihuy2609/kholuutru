const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['node_modules', 'dist', '.git', '.vscode', '.agent'];
const ALLOWED_EXTS = ['.ts', '.tsx', '.sql', '.css', '.html', '.json'];

// Bỏ qua package-lock.json vì nó quá dài và không cần thiết để phân tích logic
const IGNORE_FILES = ['package-lock.json', 'all-code.txt', 'all-code.md'];

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!IGNORE_DIRS.includes(file)) {
                arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
            }
        } else {
            const ext = path.extname(file);
            if (ALLOWED_EXTS.includes(ext) && !IGNORE_FILES.includes(file)) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

try {
    const allFiles = getAllFiles(__dirname);
    let outputContent = '';

    allFiles.forEach(file => {
        const relativePath = path.relative(__dirname, file).replace(/\\/g, '/');
        const content = fs.readFileSync(file, 'utf8');
        const ext = path.extname(file).substring(1);
        
        outputContent += `\n\n================================================================================\n`;
        outputContent += `FILE: ${relativePath}\n`;
        outputContent += `================================================================================\n\n`;
        
        // Thêm markdown code block để dễ đọc
        let language = ext === 'tsx' ? 'tsx' : ext === 'ts' ? 'typescript' : ext;
        outputContent += `\`\`\`${language}\n`;
        outputContent += content;
        if (!content.endsWith('\n')) outputContent += '\n';
        outputContent += `\`\`\`\n`;
    });

    const outputPath = path.join(__dirname, 'all-code.md');
    fs.writeFileSync(outputPath, outputContent, 'utf8');
    console.log(`✅ Đã gộp thành công ${allFiles.length} files vào: all-code.md`);
} catch (error) {
    console.error('❌ Lỗi khi gộp file:', error);
}
