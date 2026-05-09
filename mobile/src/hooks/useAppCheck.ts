import { useEffect, useState } from 'react';

/**
 * App Check is a Firebase-specific feature.
 * Since we migrated to Supabase, this hook is now a no-op stub
 * that maintains the same interface so nothing breaks.
 */

export const initializeAppCheck = async () => {
    // No-op: App Check is Firebase-specific and no longer needed.
};

export const useAppCheck = () => {
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        setIsInitialized(true);
    }, []);

    return {
        isInitialized,
        error: null,
        isEnabled: false,
    };
};

export const getAppCheckToken = async (): Promise<string | null> => {
    return null;
};

export default useAppCheck;
