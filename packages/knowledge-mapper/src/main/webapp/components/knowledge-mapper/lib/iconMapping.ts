import React from 'react';
import Servers from '@splunk/react-icons/Servers';
import NetworkConnector from '@splunk/react-icons/NetworkConnector';
import Portrait from '@splunk/react-icons/Portrait';

const iconMap: { [key: string]: any } = {
    host: Servers,
    ip: NetworkConnector,
    user: Portrait,
};

export const getIconForType = (type: string | undefined): React.ReactElement | null => {
    if (!type) {
        return null;
    }
    const IconComponent = iconMap[type];
    return IconComponent ? <IconComponent /> : null;
}; 