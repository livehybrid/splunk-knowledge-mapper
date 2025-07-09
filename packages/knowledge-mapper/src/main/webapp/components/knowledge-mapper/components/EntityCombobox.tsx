import React from 'react';
import ComboBox from '@splunk/react-ui/ComboBox';
import Servers from '@splunk/react-icons/Servers';
import NetworkConnector from '@splunk/react-icons/NetworkConnector';
import Portrait from '@splunk/react-icons/Portrait';
import { EntityNode } from '../types/entityExplorer';

interface EntityComboboxProps {
    value: string;
    onValueChange: (value: string) => void;
    nodes: EntityNode[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

const iconMap: { [key: string]: any } = {
    host: Servers,
    ip: NetworkConnector,
    user: Portrait,
    asset: Servers,
    system: Servers,
    threat: Portrait,
};

const getIconForType = (type: string | undefined): React.ReactElement | null => {
    if (!type) {
        return null;
    }
    const IconComponent = iconMap[type];
    return IconComponent ? <IconComponent /> : null;
};

export const EntityCombobox = ({ value, onValueChange, nodes, placeholder, disabled, className }: EntityComboboxProps) => {
    const handleChange = (e: any, { value: newValue }: { value: string }) => {
        onValueChange(newValue);
    };

    return (
        <ComboBox
            value={value}
            onChange={handleChange}
            placeholder={placeholder || "Select entity..."}
            disabled={disabled}
            className={className}
            inline
        >
            {nodes.map(node => (
                <ComboBox.Option
                    key={node.id}
                    value={node.id}
                    label={`${node.label} (${node.id})`}
                    icon={getIconForType(node.type)}
                />
            ))}
        </ComboBox>
    );
};
