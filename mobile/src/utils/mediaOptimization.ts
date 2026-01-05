import * as ImageManipulator from 'expo-image-manipulator';

export type MediaType = 'feed' | 'carousel' | 'profile' | 'kyc_selfie' | 'kyc_id';

export const compressImage = async (
    uri: string,
    type: MediaType
): Promise<string> => {
    const configs: Record<MediaType, { width: number; height: number; quality: number }> = {
        feed: { width: 1080, height: 1350, quality: 0.85 },
        carousel: { width: 1080, height: 1080, quality: 0.85 },
        profile: { width: 400, height: 400, quality: 0.90 },
        kyc_selfie: { width: 1080, height: 1080, quality: 0.95 },
        kyc_id: { width: 1920, height: 1080, quality: 0.95 },
    };

    const config = configs[type];

    try {
        const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: config.width, height: config.height } }],
            { compress: config.quality, format: ImageManipulator.SaveFormat.JPEG }
        );
        return result.uri;
    } catch (error) {
        console.error('Image compression failed:', error);
        return uri;
    }
};
