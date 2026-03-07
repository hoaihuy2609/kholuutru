import { describe, it, expect } from 'vitest';
import { xorObfuscate, xorDeobfuscate, fnvHash } from '../lib/crypto';

describe('xorObfuscate / xorDeobfuscate', () => {
    it('round-trips ASCII text', () => {
        const original = 'Hello, PhysiVault!';
        const encoded = xorObfuscate(original);
        expect(encoded).not.toBe(original);
        expect(xorDeobfuscate(encoded)).toBe(original);
    });

    it('round-trips Vietnamese text', () => {
        const original = 'Xin chào Thầy Huy! Vật lý lớp 12 — Dao Động Điều Hòa';
        expect(xorDeobfuscate(xorObfuscate(original))).toBe(original);
    });

    it('round-trips JSON payload', () => {
        const obj = { lessons: [{ id: '1', name: 'Test' }], files: { '1': [] } };
        const json = JSON.stringify(obj);
        expect(JSON.parse(xorDeobfuscate(xorObfuscate(json)))).toEqual(obj);
    });

    it('round-trips empty string', () => {
        expect(xorDeobfuscate(xorObfuscate(''))).toBe('');
    });

    it('round-trips large payload (100KB)', () => {
        const large = 'A'.repeat(100_000);
        expect(xorDeobfuscate(xorObfuscate(large))).toBe(large);
    });

    it('deobfuscate returns original if not encoded', () => {
        expect(xorDeobfuscate('plain text that is not base64!')).toBe('plain text that is not base64!');
    });
});

describe('fnvHash', () => {
    it('produces consistent hashes', () => {
        const h1 = fnvHash('test-input');
        const h2 = fnvHash('test-input');
        expect(h1).toBe(h2);
    });

    it('produces different hashes for different inputs', () => {
        const h1 = fnvHash('lesson-1:name-a');
        const h2 = fnvHash('lesson-1:name-b');
        expect(h1).not.toBe(h2);
    });

    it('returns a string', () => {
        expect(typeof fnvHash('anything')).toBe('string');
    });

    it('handles empty string', () => {
        expect(typeof fnvHash('')).toBe('string');
        expect(fnvHash('').length).toBeGreaterThan(0);
    });
});
