/**
 * Safely parses various PostgreSQL date string formats (including those with spaces
 * and microseconds offsets like "2026-05-31 12:18:24.567868+00") into a JavaScript Date object.
 * Returns null if the value is invalid or empty.
 */
export function parsePostgresDate(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
        const cleaned = val.trim();
        // Regex to parse various PostgreSQL date formats:
        // Group 1: YYYY-MM-DD
        // Group 2: HH:MM:SS
        // Group 3: Milliseconds/Microseconds (optional)
        // Group 4: Timezone offset or Z (optional)
        const match = cleaned.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)?$/);
        if (match) {
            const datePart = match[1];
            const timePart = match[2];
            const msPart = match[3] ? match[3].substring(0, 3).padEnd(3, '0') : '000';
            let tzPart = match[4] || 'Z';
            
            if (tzPart !== 'Z') {
                if (tzPart.length === 3) { // e.g., +00 or -05
                    tzPart = tzPart + ':00';
                } else if (tzPart.length === 5) { // e.g., +0000 or -0500
                    tzPart = tzPart.substring(0, 3) + ':' + tzPart.substring(3);
                }
            }
            
            const isoStr = `${datePart}T${timePart}.${msPart}${tzPart}`;
            const parsed = new Date(isoStr);
            if (!isNaN(parsed.getTime())) return parsed;
        }
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Parses a PostgreSQL date into millisecond timestamp, fallback to Date.now() or null.
 */
export function parsePostgresDateToMs(val: any, fallback: number = Date.now()): number {
    const d = parsePostgresDate(val);
    return d ? d.getTime() : fallback;
}

export function parsePostgresDateToMsOrNull(val: any): number | null {
    const d = parsePostgresDate(val);
    return d ? d.getTime() : null;
}
