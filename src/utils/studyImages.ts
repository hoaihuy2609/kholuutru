import { CLOUDFLARE_PROXY_URL } from '../lib/telegram';
import { normalizeQuestionImageWidth } from './questionImage';
import { getBlogImageReference } from './blogImageUploads';

export interface StudyImage {
    key?: string;
    file_id?: string;
    url?: string;
    svg?: string;
    tikz?: string;
    layout?: 'auto' | 'right' | 'bottom';
    width?: number;
}

export interface EditableStudyImage extends StudyImage {
    file?: File;
}

export const studyImageFields = ['questionImages', 'solutionImages'] as const;
export type StudyImageField = typeof studyImageFields[number];

export function studyImageKey(value: string) {
    return value.trim().replace(/\.(png|jpe?g)$/i, '').toLowerCase();
}

export function matchStudyImageFiles(files: File[], targets: { id: string; key: string }[]) {
    const names = new Map<string, number>();
    for (const file of files) {
        const key = studyImageKey(file.name);
        names.set(key, (names.get(key) ?? 0) + 1);
    }
    return files.map(file => {
        const key = studyImageKey(file.name);
        const matches = targets.filter(target => target.key === key);
        return { file, targetId: matches.length === 1 && names.get(key) === 1 ? matches[0].id : '' };
    });
}

export function readStudyImages(value: unknown, keys?: unknown): StudyImage[] {
    const images: StudyImage[] = [];
    if (Array.isArray(value)) {
        for (const image of value) {
            if (!image || typeof image !== 'object') continue;
            const key = typeof image.key === 'string' ? studyImageKey(image.key) : undefined;
            const file_id = typeof image.file_id === 'string' ? image.file_id : undefined;
            const url = typeof image.url === 'string' ? image.url : undefined;
            const svg = typeof image.svg === 'string' ? image.svg : undefined;
            const tikz = typeof image.tikz === 'string' ? image.tikz : undefined;
            const layout = image.layout === 'auto' || image.layout === 'right' || image.layout === 'bottom' ? image.layout : undefined;
            const width = normalizeQuestionImageWidth(image.width);
            if (key || file_id || url || svg || tikz) images.push({ key, file_id, url, svg, tikz, layout, width });
        }
    }
    if (Array.isArray(keys)) {
        for (const item of keys) {
            if (typeof item !== 'string') continue;
            const key = studyImageKey(item);
            if (key && !images.some(image => image.key === key)) images.push({ key });
        }
    }
    return images;
}

export function studyImageSrc(image: StudyImage) {
    const { localUrl, remoteId } = getBlogImageReference(image.file_id ?? '');
    return image.svg ? 'data:image/svg+xml,' + encodeURIComponent(image.svg)
        : image.url || localUrl || (remoteId && CLOUDFLARE_PROXY_URL
        ? CLOUDFLARE_PROXY_URL + '/getFile/' + encodeURIComponent(remoteId) : '');
}

export function layoutStudySolutionImages<T extends EditableStudyImage>(text: string, images: T[]) {
    const parts = studyImageParts(text, images);
    const lastText = parts.map(part => typeof part === 'string').lastIndexOf(true);
    const sideImages: T[] = [];
    const body = parts.filter((part, index) => {
        if (text.trim() && index > lastText && typeof part !== 'string' && (part.layout === 'right' || part.layout === 'auto')) {
            sideImages.push(part);
            return false;
        }
        return true;
    });
    return { body, sideImages };
}

export function studyImageParts<T extends EditableStudyImage>(text: string, images: T[]): (string | T)[] {
    const remaining = images.filter(image => image.file || studyImageSrc(image));
    const parts = text.split(/(\[image(?::[^\]\r\n]+)?\])/gi).map((part, index) => {
        if (index % 2 === 0) return part;
        const key = part.includes(':') ? studyImageKey(part.slice(7, -1)) : '';
        const position = key ? remaining.findIndex(image => image.key === key) : 0;
        return position >= 0 ? remaining.splice(position, 1)[0] ?? part : part;
    });
    return [...parts, ...remaining];
}

export function validStudyImage(file: File) {
    return (file.type === 'image/png' || file.type === 'image/jpeg')
        && file.size > 0 && file.size <= 5 * 1024 * 1024;
}
