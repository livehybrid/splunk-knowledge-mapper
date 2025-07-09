# Project Review: Knowledge Mapper

This document outlines how the Knowledge Mapper application meets the key criteria of the hackathon.

### Fit

The application shows a strong alignment with the hackathon's goals by solving a critical, real-world problem for a core Splunk persona: the security analyst. It directly addresses the time-consuming challenge of manually correlating disparate data points during an investigation. By transforming raw log data into an intuitive, explorable knowledge graph, the app empowers users to derive insights and make faster decisions, demonstrating a perfect fit for a data-driven Splunk application.

### Functionality / Usability

The application provides a fully functional and seamless user experience that exceeds the original MVP goals.

*   **Modern UI:** It features a polished and intuitive interface built on Splunk's own `@splunk/react-ui` framework, fulfilling the "ReactJS UI" stretch goal. The UI allows for seamless searching, graph exploration, and drilling down into entity and relationship details.
*   **Out-of-the-Box Demo:** The app ships with a rich, pre-packaged dataset (via Splunk lookups) that allows judges and new users to experience the full power of the visualization and exploration capabilities immediately after installation, with no data configuration required.
*   **Designed for Extensibility:** The backend is built on a simple and powerful Splunk macro (`get_knowledge_graph`). This modular design allows end-users to easily adapt the application to their own environment by updating a single search macro to point to their own data sources (e.g., CIM data models), without needing to modify any of the UI code.

### Innovation

The project demonstrates innovation by combining several key concepts into a novel solution for security analytics.

*   **Dynamic Frontend on Splunk Data:** It moves beyond traditional dashboards, providing a dynamic, stateful React application that visualizes complex relationships from standard Splunk search results.
*   **Knowledge Graph Abstraction:** The application successfully abstracts complex log data into a simple, powerful node-and-edge graph structure, making intricate connections immediately understandable.
*   **Integrated Anomaly Detection (Proof of Concept):** The UI is built to visually highlight anomalous relationships (e.g., with colored edges). The included sample data contains examples of these flagged anomalies, demonstrating the full workflow. This serves as a powerful proof-of-concept for the integrated AI/ML capability, which users can enable on their own data by adapting the search macro to incorporate MLTK-driven scoring.

### Business Value

The Knowledge Mapper delivers significant and immediate business value by directly addressing a major pain point in security operations.

*   **Reduced Mean Time to Resolution (MTTR):** By automating the tedious task of "connecting the dots," the app drastically reduces the time analysts spend on manual investigation, allowing them to understand the scope of an incident and identify root causes more quickly.
*   **Democratized Analytics:** The intuitive visual interface makes complex analysis accessible to a wider range of security personnel, not just senior SPL experts.
*   **High Operational Efficiency:** The app is a force multiplier for security teams, allowing them to investigate more alerts with greater accuracy and speed, thus improving the overall security posture of the organization. 