/**
 * Normalize a Vietnamese phone number from localStorage or user input.
 * - Strips all non-digit characters (spaces, dashes, dots, etc.)
 * - Handles +84 prefix
 * - Prepends '0' if 9 digits and missing leading zero
 * - Returns null if the result is not a valid 10-11 digit number
 */
export const normalizePhone = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    let phone = String(raw).replace(/\D/g, '');
    if (!phone) return null;
    // Handle +84 prefix: 84xxxxxxxxx → 0xxxxxxxxx
    if (phone.startsWith('84') && phone.length === 11) phone = '0' + phone.slice(2);
    // Handle missing leading zero for 9-digit numbers
    if (phone.length === 9 && !phone.startsWith('0')) phone = '0' + phone;
    // Final validation: must be 10-11 digits
    if (!/^\d{10,11}$/.test(phone)) return null;
    return phone;
};

/**
 * Read the activated phone number from localStorage, already normalized.
 */
export const getActivatedPhone = (): string | null => {
    return normalizePhone(localStorage.getItem('pv_activated_sdt'));
};
