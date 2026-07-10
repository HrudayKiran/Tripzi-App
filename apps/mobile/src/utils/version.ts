export const compareVersions = (a: string, b: string): number => {
    const aParts = a.split('.').map((part) => parseInt(part, 10) || 0);
    const bParts = b.split('.').map((part) => parseInt(part, 10) || 0);
    const max = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < max; i++) {
        const left = aParts[i] || 0;
        const right = bParts[i] || 0;
        if (left > right) return 1;
        if (left < right) return -1;
    }

    return 0;
};

