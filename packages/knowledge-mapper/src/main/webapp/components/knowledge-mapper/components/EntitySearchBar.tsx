import React, { useState, useEffect } from 'react';
import { EntityCombobox } from './EntityCombobox';
import Button from '@splunk/react-ui/Button';
import { EntityNode } from '../types/entityExplorer';

interface EntitySearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  nodes: EntityNode[];
  initialValue?: string;
}

export const EntitySearchBar = ({ onSearch, isLoading, nodes, initialValue }: EntitySearchBarProps) => {
  const [searchQuery, setSearchQuery] = useState(initialValue || '');

  useEffect(() => {
    if (initialValue) {
      setSearchQuery(initialValue);
    }
  }, [initialValue]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery) {
      onSearch(searchQuery);
    }
  };

  const handleComboboxChange = (newValue: string) => {
    setSearchQuery(newValue);
    onSearch(newValue);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1 }}>
      <EntityCombobox
        nodes={nodes}
        value={searchQuery}
        onValueChange={handleComboboxChange}
        placeholder="Search for an entity to begin..."
        disabled={isLoading}
        className="flex-grow"
      />
      <Button
        onClick={handleSearch}
        disabled={isLoading || !searchQuery}
        appearance="primary"
      >
        Explore
      </Button>
    </div>
  );
};
