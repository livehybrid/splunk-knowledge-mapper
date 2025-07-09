# Knowledge Mapper - A Splunk App for Visualizing Connected Data

Knowledge Mapper is a powerful Splunk application designed to help users explore and visualize complex relationships within their data. It transforms raw data into an interactive network graph, making it easy to discover hidden connections, trace paths between entities, and identify anomalous patterns. This app was built for the Splunk Hackathon.

## Key Features

*   **Interactive Network Graph:** Visualize entities and their relationships in a dynamic, easy-to-navigate graph.
*   **Entity Explorer:** Start with a single entity and interactively expand its connections to uncover the full scope of its relationships, degree by degree.
*   **Efficient Data Loading:** The UI loads instantly and populates with a list of all available entities, with the graph for the first entity displayed by default. Data is fetched iteratively, ensuring the app is responsive even with large datasets.
*   **Relationship Finder:** Discover and visualize the shortest path between any two entities in your dataset using a high-performance, bi-directional search.
*   **Flexible Anomaly Detection:** The UI can visually highlight any data points your SPL query flags with `isAnomaly=true`, allowing you to integrate your own custom anomaly detection logic seamlessly.
*   **Modern UI:** A clean, intuitive interface built with Splunk's React UI library.

## How It Works (Architecture)

The application uses a modern, client-driven architecture that is optimized for performance and interactivity.

*   **Backend (Splunk):**
    *   **Data Lookups:** The core data is sourced from standard CSV lookups (`entities.csv`, `relationships.csv`).
    *   **Targeted Macros:** A set of simple, efficient macros provides the data to the frontend.
        *   `get_unique_entities`: Quickly provides a list of all nodes to populate the UI.
        *   `get_relationships_for_nodes`: The core data engine, which takes a list of nodes and returns their relationships.
*   **Frontend (React):**
    *   **Iterative Fetching:** On initial load, the frontend fetches the list of all entities. It then fetches the graph for the first entity. As the user expands the graph, the client makes targeted calls to the backend, requesting only the new information needed. This client-side logic keeps the experience fast and reduces the load on the Splunk search head.
    *   **Splunk UI & APIs:** The interface is built with `@splunk/react-ui` and communicates with the backend via the `@splunk/search-job` API.

A more detailed diagram and technical explanation, including the specific data formats required, can be found in **`docs/architecture.md`**.

## Installation

There are two ways to install the Knowledge Mapper app.

### Option 1: Installation for Users (Recommended)

1.  Go to the [**Releases Page**](https://github.com/livehybrid/splunk-knowledge-mapper/releases) on GitHub.
2.  Download the latest `knowledge-mapper.tar.gz` file from the most recent release.
3.  In your Splunk instance, navigate to **Apps > Manage Apps**.
4.  Click **Install app from file**.
5.  Upload the `knowledge-mapper.tar.gz` file you just downloaded.
6.  Restart Splunk if prompted.

### Option 2: Installation for Developers

Follow these steps if you want to modify the source code.

#### Prerequisites

*   Splunk Enterprise 8.x or higher
*   Node.js (v16 or higher)
*   Yarn (v1.x)

#### Steps

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/livehybrid/splunk-knowledge-mapper.git
    cd knowledge-mapper
    ```
2.  **Install Dependencies**
    ```bash
    yarn install
    ```
3.  **Build the Splunk App**
    ```bash
    yarn run build
    ```
    This command compiles the application and places the necessary files in the `packages/knowledge-mapper/stage` directory.
4.  **Package the App**
    Manually create a `.tar.gz` archive from the contents of the `stage` directory. For example, on macOS or Linux:
    ```bash
    cd packages/knowledge-mapper/stage
    tar -czf knowledge-mapper.tar.gz *
    ```
    This will create `knowledge-mapper.tar.gz` inside the `stage` directory.
5.  **Install the App in Splunk**
    *   Follow steps 3-6 from the "Installation for Users" section above, using the `knowledge-mapper.tar.gz` file you just created.

## Customizing Data

By default, the app uses `entities.csv` and `relationships.csv`. You can replace these with your own data.

1.  **Prepare Your Data:** Ensure your lookup files match the format described in `docs/architecture.md` under the "Data Contract" section.
2.  **Replace Lookups:** Place your `entities.csv` and `relationships.csv` files in the app's lookup directory (`$SPLUNK_HOME/etc/apps/knowledge_mapper/lookups/`) and restart Splunk.

The app should now be using your custom data.

## Usage Guide

1.  After installation, find **Knowledge Mapper** in the Splunk app list and click on it.
2.  **Entity Explorer:**
    *   The page loads with a graph for the first entity in your dataset.
    *   Use the dropdown to select a different starting entity.
    *   Use the "Degrees" slider to expand the search to more distant relationships.
    *   Click on any node in the graph to see its details in the side panel.
3.  **Relationship Finder:**
    *   Navigate to this page using the app's navigation bar.
    *   Select a "Source" and "Target" entity.
    *   Click "Find Path" to see the shortest path between them.

## Tech Stack

*   **Frontend:** React, TypeScript, Splunk React UI, Vis.js
*   **Backend:** Splunk SPL
*   **Build Tools:** Webpack, Babel
*   **Monorepo Management:** Lerna, Yarn Workspaces

## Hackathon Guideline Compliance

This project meets the Splunk Hackathon guidelines:

1.  **Splunk App:** It is a fully functional Splunk app.
2.  **App-Driven Investigation:** It provides a purpose-built UI for investigating complex relationships in data, going beyond standard dashboards.
3.  **Use of Splunk SDKs/APIs:** It utilizes the Splunk Search Job API (`@splunk/search-job`) for backend communication.
4.  **Clear README:** This file provides detailed instructions for setup and usage.
5.  **Architecture Overview:** A technical overview is available in `docs/architecture.md`.
6.  **Packaged App:** Access the latest automated build at https://github.com/livehybrid/splunk-knowledge-mapper/releases or use the build process above.
7. **Submission:** For more information on the original submission see docs/SUBMISSION.md
