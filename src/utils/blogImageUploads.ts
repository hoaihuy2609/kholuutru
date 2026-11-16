import type { BlogPost } from '../../types';

export interface BlogImageUpload {
    token: string;
    file: File;
}

export type BlogSaveInput = Partial<BlogPost> & { imageUploads?: BlogImageUpload[] };

const pendingImages = new Map<string, File>();
const imageUrls = new Map<string, string>();
const uploadedImageIds = new Map<string, string>();

export function rememberBlogImages(files: BlogImageUpload[], uploaded: Record<string, string> = {}) {
    for (const { token, file } of files) pendingImages.set(token, file);
    for (const [token, id] of Object.entries(uploaded)) {
        uploadedImageIds.set(token, id);
        pendingImages.delete(token);
    }
}

export function getBlogImageReference(id: string): { remoteId?: string; localUrl?: string } {
    if (!id.startsWith('pv-local-image:')) return { remoteId: id };
    const uploaded = uploadedImageIds.get(id);
    if (uploaded) return { remoteId: uploaded };
    const file = pendingImages.get(id);
    let localUrl = imageUrls.get(id);
    if (!localUrl && file && typeof URL.createObjectURL === 'function') {
        localUrl = URL.createObjectURL(file);
        imageUrls.set(id, localUrl);
    }
    return { localUrl };
}

export function replaceBlogImageTokens(content: string, uploaded: Record<string, string>) {
    return content.replace(/"pv-local-image:[\w-]+"/g, token => {
        const id = uploaded[token.slice(1, -1)];
        return id ? JSON.stringify(id) : token;
    });
}
