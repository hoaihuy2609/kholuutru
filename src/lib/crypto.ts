import CryptoJS from 'crypto-js';

const SYSTEM_SALT = "PHV_SECURITY_2026_BY_HUY";
const XOR_KEY = 'PHV2026';
const XOR_KEY_BYTES = new TextEncoder().encode(XOR_KEY);
const XOR_KEY_LEN = XOR_KEY_BYTES.length;

export const xorObfuscate = (data: string): string => {
    const bytes = new TextEncoder().encode(data);
    const len = bytes.length;
    const result = new Uint8Array(len);
    const kLen = XOR_KEY_LEN;
    const alignedLen = len - (len % kLen);

    for (let i = 0; i < alignedLen; i += kLen) {
        for (let j = 0; j < kLen; j++) {
            result[i + j] = bytes[i + j] ^ XOR_KEY_BYTES[j];
        }
    }
    for (let i = alignedLen; i < len; i++) {
        result[i] = bytes[i] ^ XOR_KEY_BYTES[i - alignedLen];
    }

    const CHUNK_SIZE = 0x8000;
    let binaryParts: string[] = [];
    for (let i = 0; i < len; i += CHUNK_SIZE) {
        const chunk = result.subarray(i, i + CHUNK_SIZE);
        // @ts-ignore
        binaryParts.push(String.fromCharCode.apply(null, chunk));
    }
    return btoa(binaryParts.join(''));
};

export const xorDeobfuscate = (encoded: string): string => {
    try {
        const binaryStr = atob(encoded);
        const len = binaryStr.length;
        const result = new Uint8Array(len);
        const kLen = XOR_KEY_LEN;
        const alignedLen = len - (len % kLen);

        for (let i = 0; i < alignedLen; i += kLen) {
            for (let j = 0; j < kLen; j++) {
                result[i + j] = binaryStr.charCodeAt(i + j) ^ XOR_KEY_BYTES[j];
            }
        }
        for (let i = alignedLen; i < len; i++) {
            result[i] = binaryStr.charCodeAt(i) ^ XOR_KEY_BYTES[i - alignedLen];
        }

        return new TextDecoder().decode(result);
    } catch {
        return encoded;
    }
};

export const fnvHash = (s: string): string => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
};

export const getMachineId = (): string => {
    const parts: string[] = [];

    // Canvas fingerprint
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const txt = 'PhysiVault_Fingerprint_2026';
        if (ctx) {
            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial'";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = "#069";
            ctx.fillText(txt, 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText(txt, 4, 17);
        }
        parts.push(canvas.toDataURL());
    } catch { }

    // WebGL fingerprint
    try {
        const gl = document.createElement('canvas').getContext('webgl');
        if (gl) {
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            parts.push(gl.getParameter(gl.VENDOR) || '');
            parts.push(gl.getParameter(gl.RENDERER) || '');
            if (ext) {
                parts.push(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || '');
                parts.push(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
            }
        }
    } catch { }

    // Hardware + platform
    parts.push(navigator.userAgent || '');
    parts.push(String(screen.height * screen.width));
    parts.push(String(navigator.hardwareConcurrency || 0));
    parts.push(navigator.language || '');
    parts.push(String((navigator as any).deviceMemory || 0));
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');

    const hash = CryptoJS.SHA256(parts.join('||')).toString();
    return hash.substring(0, 12).toUpperCase().replace(/(.{4})/g, '$1-').slice(0, -1);
};

export const generateActivationKey = (machineId: string, sdt: string = ""): string => {
    const normalizedSdt = sdt.replace(/^0+/, "");
    const rawData = machineId + normalizedSdt + SYSTEM_SALT;
    const hash = CryptoJS.SHA256(rawData).toString();
    return "PV-" + hash.substring(0, 12).toUpperCase().replace(/(.{4})/g, '$1-').slice(0, -1);
};

export const checkActivationStatus = (): boolean => {
    return localStorage.getItem('physivault_activated') === 'true';
};

// ── AES-GCM encryption (Web Crypto API — hardware-accelerated) ──
const AES_KEY_RAW = 'PHV2026_AES256_KEY_PADDING_OK!!'; // 32 bytes for AES-256
const AES_MAGIC = new Uint8Array([0x50, 0x56, 0x41, 0x45]); // "PVAE" magic header

let _aesKeyCache: CryptoKey | null = null;
const getAesKey = async (): Promise<CryptoKey> => {
    if (_aesKeyCache) return _aesKeyCache;
    _aesKeyCache = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(AES_KEY_RAW),
        { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
    return _aesKeyCache;
};

export const aesEncrypt = async (plaintext: string): Promise<Uint8Array> => {
    const key = await getAesKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const result = new Uint8Array(AES_MAGIC.length + iv.length + ciphertext.byteLength);
    result.set(AES_MAGIC, 0);
    result.set(iv, AES_MAGIC.length);
    result.set(new Uint8Array(ciphertext), AES_MAGIC.length + iv.length);
    return result;
};

export const aesDecrypt = async (data: Uint8Array): Promise<string> => {
    const key = await getAesKey();
    const iv = data.slice(AES_MAGIC.length, AES_MAGIC.length + 12);
    const ciphertext = data.slice(AES_MAGIC.length + 12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
};

export const isAesEncrypted = (data: Uint8Array): boolean => {
    if (data.length < 4) return false;
    return data[0] === 0x50 && data[1] === 0x56 && data[2] === 0x41 && data[3] === 0x45;
};

export const smartDecrypt = async (data: Uint8Array | string): Promise<string> => {
    if (typeof data === 'string') {
        const fc = data.charCodeAt(0);
        if (fc === 123 || fc === 91) return data;
        return xorDeobfuscate(data);
    }
    if (isAesEncrypted(data)) return aesDecrypt(data);
    const str = new TextDecoder().decode(data);
    const fc = str.charCodeAt(0);
    if (fc === 123 || fc === 91) return str;
    return xorDeobfuscate(str);
};

// ── Admin token (signed, machine-bound, expires weekly) ──
const ADMIN_TOKEN_SALT = 'PV_ADM_VERIFY_2026_HUY';
const ADMIN_TOKEN_KEY = 'pv_admin_token';

export const generateAdminToken = (): string => {
    const machineId = getMachineId();
    const week = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
    return CryptoJS.SHA256(machineId + ADMIN_TOKEN_SALT + week).toString().substring(0, 24);
};

export const verifyAdminToken = (): boolean => {
    const stored = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!stored) return false;
    return stored === generateAdminToken();
};

export const setAdminToken = () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, generateAdminToken());
};

export const clearAdminToken = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
};
