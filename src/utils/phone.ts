/**
 * Normalize a Vietnamese phone number from localStorage or user input.
 * - Trims whitespace
 * - Prepends '0' if 9 digits and missing leading zero
 * - Returns null if no phone string provided
 */
export const normalizePhone = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    let phone = String(raw).trim();
    if (!phone) return null;
    if (phone.length === 9 && !phone.startsWith('0')) phone = '0' + phone;
    return phone;
};

/**
 * Read the activated phone number from localStorage, already normalized.
 */
export const getActivatedPhone = (): string | null => {
    return normalizePhone(localStorage.getItem('pv_activated_sdt'));
};
