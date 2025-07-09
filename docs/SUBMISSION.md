This could potentially be a good candidate for Track 4 due to ties with AI/ML in addition to the app-development track however this focusses a lot on custom UI and backend process which might also be suited to Track 1.

Entity Knowledge Explorer for Splunk is an innovative application designed to automatically discover, correlate, and visualize relationships between key entities (like users, hosts, IP addresses, processes) found within your existing Splunk data. Security analysts and incident responders often spend excessive time manually piecing together these connections across disparate logs. This app addresses that challenge by building and maintaining a dynamic knowledge graph of these interactions. It provides an intuitive visual interface for exploring these entity networks, allowing users to quickly understand complex scenarios, identify attack paths, or uncover anomalous connections. For instance, an analyst could easily see "User X logged into Host Z, which then made an outbound connection to malicious IP A, and later Process Y was launched on Host Z by User X."

MVP Features:

Automated Entity & Relationship Extraction:
Scheduled SPL searches run against CIM-compliant data (e.g., Authentication, Network_Traffic, Endpoint) to identify key entities and their interactions (e.g., login, network connection, process execution).
Knowledge Graph Storage:
Store extracted entities (nodes) and relationships (edges with metadata like timestamp, action, sourcetype) in Splunk's KV Store for efficient querying and updates.
Interactive Graph Visualization:
A Splunk dashboard featuring a graph visualization (e.g., force-directed graph/ Splunk Business Flow style)
Users can search for a starting entity (e.g., an IP address, username).
Clicking on nodes in the graph expands their direct connections, allowing for intuitive exploration.
Display tooltips with details on entities and relationships.
Basic Filtering: Allow users to filter the displayed graph by time range.
Anomaly Scoring for Relationships using AI/ML:
Utilize Splunk MLTK (e.g., DensityFunction) to identify statistically rare or "never seen before" relationships (e.g., a user accessing a host for the first time, an unusual process communicating over the network).
Visually highlight these anomalous connections in the graph.
Stretch goal Features:

Advanced Filtering: Filter by entity types (users, hosts, IPs) or relationship types (login, connection).
Timeline View: A chronological representation of interactions for a selected entity or set of entities.
ReactJS UI: UI components using Splunk UI ReactJS framework for a more modern feel if time allows.