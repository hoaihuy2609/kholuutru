import { smartDecrypt, xorObfuscate } from '../lib/crypto';

export async function packBlogSnapshot(records: unknown[]) {
    const plain = new Blob([xorObfuscate(JSON.stringify(records))], { type: 'application/json' });
    try {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        zip.file('blog_vault_v1.json', await plain.arrayBuffer());
        const compressed = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        if (compressed.size < plain.size) return { blob: compressed, name: 'blog_vault_v2.zip' };
    } catch {
        // Keep the original format if compression fails.
    }
    return { blob: plain, name: 'blog_vault_v1.json' };
}

export async function unpackBlogSnapshot(buffer: Uint8Array): Promise<unknown> {
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
        const { default: JSZip } = await import('jszip');
        const zip = await JSZip.loadAsync(buffer);
        const file = zip.file('blog_vault_v1.json');
        if (!file) throw new Error('Không tìm thấy dữ liệu trong bản nén');
        return JSON.parse(await smartDecrypt(await file.async('uint8array')));
    }
    return JSON.parse(await smartDecrypt(buffer));
}
