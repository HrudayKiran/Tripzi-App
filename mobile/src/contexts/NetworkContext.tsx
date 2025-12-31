import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkContextType {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    connectionType: string | null;
}

const NetworkContext = createContext<NetworkContextType>({
    isConnected: null,
    isInternetReachable: null,
    connectionType: null,
});

export const useNetwork = () => useContext(NetworkContext);

interface NetworkProviderProps {
    children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
    const [networkState, setNetworkState] = useState<NetworkContextType>({
        isConnected: null,
        isInternetReachable: null,
        connectionType: null,
    });

    useEffect(() => {
        // Initial fetch
        NetInfo.fetch().then((state: NetInfoState) => {
            setNetworkState({
                isConnected: state.isConnected,
                isInternetReachable: state.isInternetReachable,
                connectionType: state.type,
            });
        });

        // Subscribe to network changes
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            setNetworkState({
                isConnected: state.isConnected,
                isInternetReachable: state.isInternetReachable,
                connectionType: state.type,
            });
        });

        return () => unsubscribe();
    }, []);

    return (
        <NetworkContext.Provider value={networkState}>
            {children}
        </NetworkContext.Provider>
    );
};

export default NetworkContext;
