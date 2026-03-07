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
    const fingerprint = canvas.toDataURL();
    const hash = CryptoJS.SHA256(fingerprint + (navigator.userAgent || '') + (screen.height * screen.width)).toString();
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
