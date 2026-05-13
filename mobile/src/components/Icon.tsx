import React from 'react';
import * as Phosphor from 'phosphor-react-native';
import { SvgProps } from 'react-native-svg';

// Define the available icon names from Phosphor
export type IconName = keyof typeof Phosphor;

type IconProps = {
    name: IconName;
    size?: number;
    color?: string;
    weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
    style?: any;
};

export const Icon = ({ 
    name, 
    size = 24, 
    color = '#000', 
    weight = 'regular',
    style 
}: IconProps) => {
    // Dynamically get the icon component
    const IconComponent = Phosphor[name] as React.ComponentType<any>;
    
    if (!IconComponent) {
        console.warn(`Icon "${name}" not found in phosphor-react-native`);
        return null;
    }
    
    return <IconComponent size={size} color={color} weight={weight} style={style} />;
};

export default Icon;
