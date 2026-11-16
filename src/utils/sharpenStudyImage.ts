import { validStudyImage } from './studyImages';

export async function sharpenStudyImage(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file);
    try {
        const { width, height } = bitmap;
        if (width < 3 || height < 3 || width * height > 6_000_000) return file;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return file;
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(0, 0, width, height);
        const source = new Uint8ClampedArray(pixels.data);
        const stride = width * 4;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const offset = y * stride + x * 4;
                if (source[offset + 3] !== 255 || source[offset - 1] !== 255 || source[offset + 7] !== 255
                    || source[offset - stride + 3] !== 255 || source[offset + stride + 3] !== 255) continue;
                for (let channel = 0; channel < 3; channel++) {
                    const i = offset + channel;
                    const neighbors = (source[i - 4] + source[i + 4] + source[i - stride] + source[i + stride]) / 4;
                    const correction = (source[i] - neighbors) * 0.25;
                    pixels.data[i] = source[i] + Math.max(-16, Math.min(16, correction));
                }
            }
        }
        context.putImageData(pixels, 0, 0);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) return file;
        const name = file.name.replace(/\.[^.]+$/, '') + '.png';
        const sharpened = new File([blob], name, { type: 'image/png' });
        return validStudyImage(sharpened) ? sharpened : file;
    } finally {
        bitmap.close();
    }
}
