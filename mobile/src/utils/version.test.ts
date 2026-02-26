import { compareVersions } from './version';

describe('compareVersions', () => {
    test('returns 0 for equal versions', () => {
        expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    test('returns 1 when left is newer', () => {
        expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    });

    test('returns -1 when right is newer', () => {
        expect(compareVersions('1.0.9', '1.1.0')).toBe(-1);
    });

    test('handles missing patch segments', () => {
        expect(compareVersions('1.0', '1.0.0')).toBe(0);
        expect(compareVersions('1.0.1', '1.0')).toBe(1);
    });
});

