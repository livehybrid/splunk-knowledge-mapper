# Page Functionality Documentation

This document details the functionality of the pages migrated from the prototype into the Knowledge Mapper Splunk application.

## Entity Explorer (`start` page)

**Purpose:**
The Entity Explorer page is designed for visualizing and exploring the relationships between different entities within the knowledge graph. It provides an interactive way to navigate and understand connections in the data.

**Functionality:**
*   **Entity Search:** A search bar allows users to find and select a specific entity to act as the central node of the graph visualization.
*   **Network Graph Display:** An interactive network graph displays the selected entity and its direct and indirect connections.
*   **Graph Degrees Control:** Users can adjust the "degrees of separation" shown in the graph. This allows for expanding the view to see entities further away from the central node or contracting it to see only immediate connections.
*   **Entity Detail Panel:** Clicking on any node (entity) in the graph will display a panel with detailed information and attributes for that entity.

## Relationship Finder (`finder` page)

**Purpose:**
The Relationship Finder page allows users to discover and analyze the specific paths and relationships that connect two entities in the graph.

**Functionality:**
*   **Source/Target Selection:** Two comboboxes allow the user to select a "source" entity and a "target" entity.
*   **Find Path:** After selecting two entities, the user can initiate a search to find the shortest path(s) between them.
*   **Results Display:** The discovered paths, including any intermediary entities and the types of relationships, are displayed in a table for analysis. 