# Knowledge Mapper: Future Enhancements

This document outlines a roadmap of potential features and improvements for the Knowledge Mapper application. It is intended to guide future development efforts, turning the current application into an even more powerful and user-friendly tool for data exploration.

## Core Functionality Enhancements

### 1. Enriched Demo Dataset
*   **Concept:** The current sample lookups (`entities.csv`, `relationships.csv`) are minimal. To provide a more compelling out-of-the-box experience, this dataset could be significantly expanded.
*   **Implementation:** Create a more complex and realistic scenario with a larger number of nodes and edges. This would better showcase the app's ability to handle scale and uncover interesting, non-obvious connections and anomalies.

## UI/UX Improvements

### 1. Advanced In-Graph Filtering
*   **Concept:** Allow users to dynamically filter the rendered graph to focus on specific types of entities or relationships without re-running a search.
*   **Implementation:** Add `MultiSelect` or similar UI controls to the page. These controls would allow users to show or hide nodes and edges based on their `group` (type). The filtering logic would be handled entirely on the client-side for immediate feedback.

### 2. Time-Based Analysis
*   **Concept:** Enable users to explore how relationships and the graph structure change over time.
*   **Implementation:**
    1.  Add a `timestamp` field to the `relationships` data source and update the data contract in `docs/architecture.md`.
    2.  Add a `TimeRangePicker` component to the UI.
    3.  Implement client-side filtering logic that shows only the relationships that fall within the selected time range.

## Advanced Integrations & Data Sources

### 1. Template for Live Splunk Data
*   **Concept:** Provide a clear, copy-paste template for users who want to connect the app to their own live Splunk data instead of using CSV lookups.
*   **Implementation:** In `macros.conf`, add a well-commented, disabled example of a macro (e.g., `knowledge_graph_cim_auth`). This macro would demonstrate how to query a standard Splunk data model (like the CIM `Authentication` model) and format the results to match the required data contract for the UI.

### 2. ML-Powered Anomaly Detection Example
*   **Concept:** Showcase the app's ability to integrate with the Splunk Machine Learning Toolkit (MLTK) to automatically flag suspicious or unusual connections.
*   **Implementation:** Add a commented-out example macro (e.g., `knowledge_graph_with_mltk`) that uses an MLTK algorithm like `DensityFunction`. This search would analyze the rarity or characteristics of relationships, dynamically generating the `isAnomaly=true` flag for the UI to highlight.

## Release Management & Distribution

### 1. Official GitHub Releases
*   **Concept:** Provide a clear and simple way for non-technical users to download and install stable, packaged versions of the application.
*   **Implementation:** Regularly create new releases on the project's [GitHub Releases page](https://github.com/livehybrid/splunk-knowledge-mapper/releases). Each release should include the packaged `knowledge-mapper.tar.gz` artifact and release notes detailing the changes. 