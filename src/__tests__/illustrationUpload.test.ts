import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadQuestionImageToTelegram } from '../services/tikzService';

vi.mock('../lib/telegram', () => ({
    TELEGRAM_CHAT_ID: 'test-chat',
    CLOUDFLARE_PROXY_URL: 'https://telegram.test',
    ADMIN_AUTH_HEADER: '',
}));

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('question illustration upload', () => {
    it('aborts and reports a timeout if Telegram sends headers but never finishes the response', async () => {
        vi.useFakeTimers();
        let signal: AbortSignal | undefined;
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
            signal = init.signal ?? undefined;
            return {
                ok: true,
                json: () => new Promise((_resolve, reject) => {
                    signal?.addEventListener('abort', () => reject(signal?.reason), { once: true });
                }),
            };
        }));
        const result = expect(uploadQuestionImageToTelegram(new File(['test'], 'figure.png')))
            .rejects.toThrow('Telegram chưa phản hồi sau 45 giây');
        await vi.advanceTimersByTimeAsync(44_999);
        expect(signal?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await result;
        expect(signal?.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });
});
