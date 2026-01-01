/**
 * Default assets and fallback URLs for the app.
 * All fallback images should be hosted or use local assets.
 * This file centralizes all default placeholders.
 */

// Default avatar - using a simple gradient color or initials is preferable
// For now, using null to trigger the Ionicons person icon fallback
export const DEFAULT_AVATAR_URL: string | null = null;

// Default trip cover image - keep one high-quality travel image as fallback
// This is acceptable as a branded placeholder for trips without images
export const DEFAULT_TRIP_IMAGE = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80';

// Default group chat image
export const DEFAULT_GROUP_IMAGE: string | null = null;

/**
 * Get a display name with fallback
 */
export const getDisplayName = (user: any): string => {
    return user?.displayName || user?.name || user?.email?.split('@')[0] || 'User';
};

/**
 * Check if a URL is a valid image URL
 */
export const isValidImageUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    return url.startsWith('https://') || url.startsWith('http://') || url.startsWith('file://');
};
