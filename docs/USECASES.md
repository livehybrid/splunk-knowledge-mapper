# Knowledge Mapper: Potential Use Cases

The Knowledge Mapper app is a powerful tool for any scenario where understanding the *context* and *relationships* between data points is more important than just viewing the data points themselves. It excels at transforming flat, tabular log data into an intuitive, interactive map of connections.

Here are some key potential use cases for the app in a Splunk environment:

### 1. Cybersecurity: Threat Hunting & Incident Response

This is a primary use case. Security analysts are constantly trying to connect disparate events to uncover the story of an attack.

*   **Scenario:** A tier-1 analyst gets an alert from a detection rule: "Rare failed login spike for user `C.Wood`."
*   **Traditional Method:** The analyst would run several manual searches: What machine did they try to log into? What other machines has that user accessed? What systems does that machine talk to? This involves multiple queries and mentally piecing together the results.
*   **Using Knowledge Mapper:**
    1.  **Initial Triage:** The analyst opens the Entity Explorer and searches for `C.Wood`. The graph instantly shows the user and the asset they failed to log into, `corp-db-01`. The relationship `failed_login` is visually highlighted as an anomaly because the SPL that generates the data has flagged it with `isAnomaly=true`.
    2.  **Assessing Blast Radius:** The analyst expands the graph by one degree. They immediately see that `corp-db-01` connects to a critical production database, `prod-finance-db`, and is managed by the administrator `D.Jones`.
    3.  **Uncovering an Attack Path:** In a single view, the analyst can now see a potential attack path: a compromised user account (`C.Wood`) is being used to try and access a corporate database, which in turn has access to a critical production system. The visual map makes the risk instantly understandable.
    4.  **Pivoting the Investigation:** The analyst can click on the `D.Jones` node to explore their recent activity, or use the Relationship Finder to see if `C.Wood` has any other, less obvious path to the `prod-finance-db`.

### 2. IT Operations: Impact Analysis & Root Cause Analysis

For IT operations, understanding service and system dependencies is critical for maintaining uptime and managing change.

*   **Scenario:** A monitoring alert fires indicating high CPU usage on a virtual machine named `app-server-12`. An operator needs to decide if they can safely reboot it.
*   **Traditional Method:** The operator would have to consult outdated diagrams, configuration management databases (CMDBs), or ask other teams what services run on that server. This is slow and prone to error.
*   **Using Knowledge Mapper:**
    1.  **Instant Dependency Mapping:** The operator searches for `app-server-12` in the Entity Explorer.
    2.  **Impact Analysis:** The graph immediately shows that `app-server-12` is a host for three critical business applications: `Online-Storefront`, `Inventory-API`, and `Payment-Gateway`. It also shows connections to a shared `Oracle-DB`.
    3.  **Informed Decision Making:** The operator now knows that rebooting this server will take down the entire e-commerce platform. Instead of a quick reboot, they can now initiate the proper change management process, notify the business stakeholders, and schedule maintenance for a low-traffic period. The visual evidence from the graph makes it easy to communicate the potential impact to non-technical managers.

### 3. Compliance & Auditing

Auditors need to verify that security and access control policies are being enforced correctly.

*   **Scenario:** An auditor needs to confirm that only members of the "Database Admins" group have access to production database servers.
*   **Traditional Method:** This would require painstakingly reviewing user group memberships, firewall rules, and database access logs—a complex and time-consuming process.
*   **Using Knowledge Mapper:**
    1.  **Visual Audit:** The auditor can load a graph of all production databases.
    2.  **Policy Verification:** They can visually trace the `manages` or `connects_to` relationships for each database. They can quickly confirm that all connections originate from users who are part of the `Database-Admins` entity type/group.
    3.  **Exception & Violation Discovery:** If they see a relationship like `Marketing-Campaign-Server` -> `connects_to` -> `Prod-Customer-DB`, it's an immediate, visual red flag that a non-compliant connection exists. This allows them to focus their investigation on a known violation instead of searching for one in millions of log entries. 