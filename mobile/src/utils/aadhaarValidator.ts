/**
 * Aadhaar Number Validator
 * Uses Verhoeff checksum algorithm to validate 12-digit Aadhaar numbers
 */

// Multiplication table
const d: number[][] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// Permutation table
const p: number[][] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/**
 * Validates an Aadhaar number using Verhoeff algorithm
 * @param aadhaar - 12-digit Aadhaar number as string
 * @returns boolean - true if valid, false otherwise
 */
export const validateAadhaar = (aadhaar: string): { valid: boolean; error?: string } => {
    // Remove any spaces or dashes
    const cleaned = aadhaar.replace(/[\s-]/g, '');

    // Check if it's exactly 12 digits
    if (!/^\d{12}$/.test(cleaned)) {
        return { valid: false, error: 'Aadhaar must be exactly 12 digits' };
    }

    // Check for invalid patterns (all same digits or sequential)
    if (/^(\d)\1{11}$/.test(cleaned)) {
        return { valid: false, error: 'Invalid Aadhaar format' };
    }

    // First digit cannot be 0 or 1
    if (cleaned[0] === '0' || cleaned[0] === '1') {
        return { valid: false, error: 'Aadhaar cannot start with 0 or 1' };
    }

    // Verhoeff checksum validation
    let c = 0;
    const reversedAadhaar = cleaned.split('').reverse().join('');

    for (let i = 0; i < reversedAadhaar.length; i++) {
        c = d[c][p[i % 8][parseInt(reversedAadhaar[i], 10)]];
    }

    if (c !== 0) {
        return { valid: false, error: 'Invalid Aadhaar number' };
    }

    return { valid: true };
};

/**
 * Formats Aadhaar number with spaces for display
 * @param aadhaar - 12-digit Aadhaar number
 * @returns formatted string like "XXXX XXXX XXXX"
 */
export const formatAadhaar = (aadhaar: string): string => {
    const cleaned = aadhaar.replace(/\D/g, '');
    const matches = cleaned.match(/.{1,4}/g);
    return matches ? matches.join(' ') : cleaned;
};

/**
 * Masks Aadhaar number for display (shows only last 4 digits)
 * @param aadhaar - 12-digit Aadhaar number
 * @returns masked string like "XXXX XXXX 1234"
 */
export const maskAadhaar = (aadhaar: string): string => {
    const cleaned = aadhaar.replace(/\D/g, '');
    if (cleaned.length !== 12) return aadhaar;
    return `XXXX XXXX ${cleaned.slice(-4)}`;
};

export default {
    validateAadhaar,
    formatAadhaar,
    maskAadhaar,
};
