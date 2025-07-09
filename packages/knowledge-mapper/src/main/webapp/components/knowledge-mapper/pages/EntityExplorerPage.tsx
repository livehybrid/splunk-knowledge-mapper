import React, { useState, useMemo, useEffect, useRef } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import { useQuery } from '@tanstack/react-query';
import { EntitySearchBar } from '../components/EntitySearchBar';
import NetworkGraphDisplay from '../components/NetworkGraphDisplay';
import EntityDetailPanel from '../components/EntityDetailPanel';
import GraphDegreesControl from "../components/GraphDegreesControl";
import { getUniqueEntities, getGraphDataIteratively } from '../services/splunkService';
import { GraphData, EntityNode, EntityEdge } from '../types/entityExplorer';
// import { toast } from '../hooks/use-toast';
import Button from '@splunk/react-ui/Button';
import SidePanel from '@splunk/react-ui/SidePanel';
import Multiselect from '@splunk/react-ui/Multiselect';
import Switch from '@splunk/react-ui/Switch';
import { NetworkGraphDisplayHandles } from '../components/NetworkGraphDisplay';

const useQuery = () => {
    return new URLSearchParams(window.location.search);
};

const entityTypes = [
    { label: 'User', value: 'user' },
    { label: 'Host', value: 'host' },
    { label: 'IP', value: 'ip' },
    { label: 'Asset', value: 'asset' },
    { label: 'System', value: 'system' },
    { label: 'Threat', value: 'threat' },
];

const EntityExplorerPage: React.FunctionComponent = () => {
    const query = useQuery();
    const graphRef = useRef<NetworkGraphDisplayHandles>(null);

    const initialEntityIdFromUrl = query.get('entityId');
    const pathNodes = query.get('pathNodes')?.split(',');
    const pathEdges = query.get('pathEdges')?.split(',');

    const [allEntities, setAllEntities] = useState<EntityNode[]>([]);
    const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);
    const [degrees, setDegrees] = useState<number>(3);
    const [typeFilters, setTypeFilters] = useState<string[]>([]);
    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);
    const [selectedItem, setSelectedItem] = useState<EntityNode | EntityEdge | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
    const [showAnomalies, setShowAnomalies] = useState<boolean>(false);
    const isShowingPath = false; // Mock for now

    useEffect(() => {
        console.log("Fetching unique entities");
        getUniqueEntities()
            .then((entities: EntityNode[]) => {
                console.log("Entities:", entities);
                setAllEntities(entities);
                const initialId = initialEntityIdFromUrl || (entities.length > 0 ? entities[0].id : undefined);
                setSelectedEntityId(initialId);
            })
            .catch((err: Error) => {
                setError(err);
                console.error("Failed to fetch unique entities:", err);
            });
    }, [initialEntityIdFromUrl]);

    useEffect(() => {
        if (selectedEntityId) {
            setIsLoading(true);
            getGraphDataIteratively(selectedEntityId, degrees, showAnomalies)
                .then((data: GraphData) => {
                    setGraphData(data);
                    const types = new Set(data.nodes.map((n: EntityNode) => n.type));
                    setTypeFilters(Array.from(types) as string[]);
                })
                .catch((err: Error) => {
                    setError(err);
                    console.error("Failed to fetch graph data:", err);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [selectedEntityId, degrees, showAnomalies]);

    const handleNodeClick = (node: EntityNode) => {
        setSelectedItem(node);
        setIsPanelOpen(true);
    };

    const handleEdgeClick = (edge: EntityEdge) => {
        setSelectedItem(edge);
        setIsPanelOpen(true);
    };

    const handleResetGraph = () => {
        setIsPanelOpen(false);
    };

    const onExplore = (nodeId: string) => {
        setSelectedEntityId(nodeId);
        setDegrees(1);
        setIsPanelOpen(false);
        if (graphRef.current) {
            graphRef.current.resetView();
        }
    };

    const filteredGraphData = useMemo(() => {
        if (!graphData) return null;

        const filteredNodes = graphData.nodes.filter(node => typeFilters.includes(node.type));
        const filteredNodeIds = new Set(filteredNodes.map(node => node.id));

        const filteredEdges = graphData.edges.filter(edge =>
            filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
        );
        
        return { nodes: filteredNodes, edges: filteredEdges };
    }, [graphData, typeFilters]);

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <header className="bg-white shadow-md p-2">
                <div className="flex items-center space-x-2">
                    <EntitySearchBar
                        onSearch={setSelectedEntityId}
                        initialValue={selectedEntityId}
                        isLoading={isLoading}
                        nodes={allEntities}
                    />
                    <GraphDegreesControl value={degrees} onChange={setDegrees} />
                    <Multiselect
                        values={typeFilters}
                        onChange={(_, { values }) => setTypeFilters(values.map(String))}
                        placeholder="Filter by type..."
                        inline
                    >
                        {entityTypes.map(type => (
                            <Multiselect.Option key={type.value} label={type.label} value={type.value} />
                        ))}
                    </Multiselect>
                    <Switch
                        value={showAnomalies}
                        onClick={() => setShowAnomalies(!showAnomalies)}
                        selected={showAnomalies}
                    >
                        Highlight Anomalies
                    </Switch>
                </div>
                
                {(isShowingPath || (selectedEntityId && !isShowingPath)) && (
                    <div className="flex items-center justify-between mt-2 space-x-4">
                        <span className="text-sm text-gray-600 font-medium">
                            {isShowingPath ? (
                                'Showing a specific path from Relationship Finder.'
                            ) : (
                                <>
                                    Showing relationships <span className="font-semibold text-blue-600">within {degrees} degree{degrees > 1 ? 's' : ''}</span> of: 
                                    <span className="ml-2 px-2 py-1 bg-blue-50 border rounded text-blue-800">{allEntities.find(e => e.id === selectedEntityId)?.label || selectedEntityId}</span>
                                </>
                            )}
                        </span>
                        <Button
                            appearance="secondary"
                            onClick={handleResetGraph}
                        >
                            Reset View
                        </Button>
                    </div>
                )}
            </header>
            <main className="flex flex-row flex-grow overflow-hidden p-4 gap-4">
                <div className="flex-grow h-full">
                    <NetworkGraphDisplay
                        ref={graphRef}
                        data={filteredGraphData}
                        isLoading={isLoading}
                        error={error}
                        selectedId={selectedItem && 'id' in selectedItem ? selectedItem.id : null}
                        onNodeClick={handleNodeClick}
                        onEdgeClick={handleEdgeClick}
                        highlightedPath={{ nodes: pathNodes, edges: pathEdges }}
                        showAnomalies={showAnomalies}
                    />
                </div>
                <SidePanel
                    open={isPanelOpen}
                    onRequestClose={() => setIsPanelOpen(false)}
                    dockPosition="right"
                    style={{ width: '30%' }}
                >
                    <EntityDetailPanel
                        selectedItem={selectedItem}
                        onExplore={onExplore}
                    />
                </SidePanel>
            </main>
        </div>
    );
};

export default EntityExplorerPage;
