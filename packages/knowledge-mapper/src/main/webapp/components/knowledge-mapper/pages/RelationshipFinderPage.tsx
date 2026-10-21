import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getUniqueEntities, getRelationshipsForNodes, edgeId } from '../services/splunkService';
import Button from '@splunk/react-ui/Button';
import Slider from '@splunk/react-ui/Slider';
import Table from '@splunk/react-ui/Table';
import Layout from '@splunk/react-ui/Layout';
import Card from '@splunk/react-ui/Card';
import { ArrowLeft, Eye } from 'lucide-react';
import Servers from '@splunk/react-icons/Servers';
import NetworkConnector from '@splunk/react-icons/NetworkConnector';
import Portrait from '@splunk/react-icons/Portrait';
import Heading from '@splunk/react-ui/Heading';
import Prose from '@splunk/react-ui/Prose';
import Divider from '@splunk/react-ui/Divider';

import { EntityCombobox } from '../components/EntityCombobox';
import { GraphData, EntityNode, EntityEdge } from '../types/entityExplorer';
import P from '@splunk/react-ui/Paragraph';

interface FoundPath {
    nodes: EntityNode[];
    edges: EntityEdge[];
    degrees: number;
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

const RelationshipFinderPage = () => {
    const [startEntity, setStartEntity] = useState<string | undefined>(undefined);
    const [endEntity, setEndEntity] = useState<string | undefined>(undefined);
    const [degrees, setDegrees] = useState(3);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const [allEntities, setAllEntities] = useState<EntityNode[]>([]);
    const [foundPaths, setFoundPaths] = useState<FoundPath[]>([]);
    const [submittedQuery, setSubmittedQuery] = useState(false);
    const [searchedDegrees, setSearchedDegrees] = useState(3);

    useEffect(() => {
        getUniqueEntities()
            .then((data: EntityNode[]) => {
                setAllEntities(data);
            })
            .catch((err: Error) => {
                setError(err);
                console.error("Failed to fetch unique entities:", err);
            });
    }, []);

    // Breadth-first search out from the start entity, one Splunk search per
    // hop, relationships taken in either direction. The first time the end
    // entity is reached is a shortest path; walking back through each
    // entity's parent gives it in order.
    const findShortestPath = useCallback(async (startId: string, endId: string, maxDegrees: number) => {
        setIsLoading(true);
        setError(null);
        setFoundPaths([]);
        try {
            const parent = new Map<string, { from: string; rel: any } | null>([[startId, null]]);
            let frontier: string[] = [startId];
            for (let hop = 0; hop < maxDegrees && frontier.length > 0 && !parent.has(endId); hop++) {
                const rels: any[] = await getRelationshipsForNodes(frontier);
                const inFrontier = new Set(frontier);
                const next: string[] = [];
                for (const rel of rels) {
                    for (const [from, to] of [[rel.source, rel.target], [rel.target, rel.source]]) {
                        if (inFrontier.has(from) && !parent.has(to)) {
                            parent.set(to, { from, rel });
                            next.push(to);
                        }
                    }
                }
                frontier = next;
            }
            if (!parent.has(endId)) {
                return;
            }
            const ids: string[] = [endId];
            const rels: any[] = [];
            for (let step = parent.get(endId); step; step = parent.get(step.from)) {
                rels.unshift(step.rel);
                ids.unshift(step.from);
            }
            const nodes = ids.map(id => allEntities.find(e => e.id === id)
                || ({ id, label: id, type: undefined } as unknown as EntityNode));
            const edges: EntityEdge[] = rels.map(rel => ({
                id: edgeId(rel),
                source: rel.source,
                target: rel.target,
                label: rel.label,
                isAnomaly: rel.isAnomaly === 'true',
            }));
            setFoundPaths([{ nodes, edges, degrees: edges.length }]);
        } catch (err) {
            setError(err as Error);
            console.error('Failed to find a path:', err);
        } finally {
            setIsLoading(false);
        }
    }, [allEntities]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittedQuery(true);
        setSearchedDegrees(degrees);
        if (startEntity && endEntity) {
            findShortestPath(startEntity, endEntity, degrees);
        }
    };

    return (
        <Layout>

            <div style={{padding: "2rem", maxWidth: "1280px", margin: "0 auto"}}>
                    <Button appearance="subtle" onClick={() => {window.location.href = "/app/knowledge-mapper/start"}}>
                        <ArrowLeft style={{marginRight: "0.5rem"}} />
                        Back to Entity Explorer
                    </Button>
                    <Heading level={1}>Relationship Finder</Heading>
                    <P>
                        Find connection paths between two entities in your environment.
                    </P>
                <Divider />
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '2rem' }}>
                    <Card>
                        <Card.Header title="Search for a Path" />
                        <Card.Body>
                            <form onSubmit={handleSearch} style={{display: "flex", flexDirection: "column", gap: "1rem"}}>
                                <div>
                                    <div>
                                        <label htmlFor="start-entity">Start Entity: </label>
                                        <EntityCombobox
                                            value={startEntity || ''}
                                            onValueChange={setStartEntity}
                                            nodes={allEntities}
                                        />
                                    </div>
                                    <br />
                                    <div>
                                        <label htmlFor="end-entity">End Entity: </label>
                                        <EntityCombobox
                                            value={endEntity || ''}
                                            onValueChange={setEndEntity}
                                            nodes={allEntities}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="degrees">Max Degrees of Separation ({degrees})</label>
                                    <Slider
                                        min={1}
                                        max={5}
                                        step={1}
                                        value={degrees}
                                        onChange={(e: any, data: { value: number }) => setDegrees(data.value)}
                                    />
                                </div>
                                <Button type="submit" appearance='primary' disabled={!startEntity || !endEntity}>
                                    Find Paths
                                </Button>
                            </form>
                        </Card.Body>
                    </Card>

                    <Card>
                        <Card.Header title="Results" />
                        <Card.Body>
                            {submittedQuery ? `Found ${foundPaths.length} path(s) between entities within ${searchedDegrees} hops.` : 'Search results will appear here.'}
                            {isLoading && <p>Searching for paths...</p>}
                            {error instanceof Error && <p style={{color: 'red'}}>Error loading data: {error.message}</p>}
                            {!isLoading && !error && (
                                <div>
                                    <Table stripeRows>
                                        <Table.Head>
                                            <Table.HeadCell>Path</Table.HeadCell>
                                            <Table.HeadCell align="right">Degrees</Table.HeadCell>
                                            <Table.HeadCell align="right">Action</Table.HeadCell>
                                        </Table.Head>
                                        <Table.Body>
                                            {foundPaths.length > 0 ? (
                                                foundPaths.map((path, index) => {
                                                    const nodeIds = path.nodes.map((n: EntityNode) => n.id).join(',');
                                                    const edgeIds = path.edges.map((e: EntityEdge) => e.id).join(',');
                                                    const startNodeId = path.nodes[0].id;
                                                    const degrees = path.degrees;
                                                    const explorerPath = `/app/knowledge-mapper/start?entityId=${encodeURIComponent(startNodeId)}&degrees=${degrees}&pathNodes=${encodeURIComponent(nodeIds)}&pathEdges=${encodeURIComponent(edgeIds)}`;

                                                    return (
                                                        <Table.Row key={index}>
                                                            <Table.Cell>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                    {path.nodes.map((n: EntityNode, i: number) => (
                                                                        <React.Fragment key={n.id}>
                                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                                {getIconForType(n.type)}
                                                                                {n.label}
                                                                            </span>
                                                                            {i < path.nodes.length - 1 && <span>→</span>}
                                                                        </React.Fragment>
                                                                    ))}
                                                                </div>
                                                            </Table.Cell>
                                                            <Table.Cell align="right">{path.degrees}</Table.Cell>
                                                            <Table.Cell align="right">
                                                                <Button appearance="subtle" onClick={() => {window.location.href = explorerPath}}>
                                                                    <Eye style={{marginRight: "0.5rem"}} />
                                                                    View
                                                                </Button>
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    );
                                                })
                                            ) : (
                                                <Table.Row>
                                                    <Table.Cell colSpan={3} style={{textAlign: "center", height: "6rem"}}>
                                                        {submittedQuery ? "No paths found." : "Please perform a search."}
                                                    </Table.Cell>
                                                </Table.Row>
                                            )}
                                        </Table.Body>
                                    </Table>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </Layout>
    );
};

export default RelationshipFinderPage;
