import React from 'react';
import Card from '@splunk/react-ui/Card';
import Button from '@splunk/react-ui/Button';
import { EntityNode, EntityEdge } from '../types/entityExplorer';

interface EntityDetailPanelProps {
  selectedItem: EntityNode | EntityEdge | null;
  onExplore?: (nodeId: string) => void;
}

const isNode = (item: EntityNode | EntityEdge): item is EntityNode => 'type' in item;

const parseDescription = (details: { [key: string]: any } | undefined) => {
    if (!details || !details.description) {
        return details;
    }

    try {
        const parsed = JSON.parse(details.description);
        if (typeof parsed === 'object' && parsed !== null) {
            const { description, ...rest } = details;
            return { ...rest, ...parsed };
        }
    } catch (e) {
        // Not a JSON string, return details as is.
    }

    return details;
};


const EntityDetailPanel = ({ selectedItem, onExplore }: EntityDetailPanelProps) => {
  if (!selectedItem) {
    return (
      <Card>
        <Card.Header title="Details" />
        <Card.Body>
          <p>Click on a node or edge to see its details here.</p>
        </Card.Body>
      </Card>
    );
  }

  const displayDetails = parseDescription(selectedItem.details);

  return (
    <Card>
      <Card.Header title={isNode(selectedItem) ? `Entity: ${selectedItem.label}` : `Relationship: ${selectedItem.label || selectedItem.id}`} />
      <Card.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isNode(selectedItem) && onExplore && (
            <Button
              appearance="primary"
              onClick={() => onExplore(selectedItem.id)}
            >
              Explore from this Node
            </Button>
          )}
          <p><strong>ID:</strong> {selectedItem.id}</p>
          {isNode(selectedItem) ? (
            <p><strong>Type:</strong> {selectedItem.type}</p>
          ) : (
            <>
              <p><strong>Source:</strong> {selectedItem.source}</p>
              <p><strong>Target:</strong> {selectedItem.target}</p>
            </>
          )}
          {!isNode(selectedItem) && selectedItem.isAnomaly && (
            <p style={{ color: 'red', fontWeight: 'bold' }}>Anomaly Detected</p>
          )}
          {displayDetails && Object.entries(displayDetails).length > 0 && (
            <div>
              <strong>Details:</strong>
              <ul>
                {Object.entries(displayDetails).map(([key, value]) => (
                  <li key={key}>
                    <strong>{key}:</strong> {String(value)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default EntityDetailPanel;
