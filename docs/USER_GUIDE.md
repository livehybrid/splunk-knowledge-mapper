# Knowledge Mapper User Guide

This guide explains how to configure the Knowledge Mapper application to use your own data sources.

## How It Works: The `get_knowledge_graph` Macro

The heart of this application is a Splunk macro named `get_knowledge_graph`. This macro is responsible for fetching and formatting all the data that is displayed in the UI.

By default, it uses the sample data included with the app:
`| inputlookup relationships.csv | ...`

To make the app work with your own data, you simply need to edit the definition of this macro.

## Step-by-Step: Connecting to Your Data

1.  **Navigate to Macro Settings:**
    *   In Splunk, go to **Settings > Advanced search > Search macros**.

2.  **Select the App Context:**
    *   Set the "App" context filter to **knowledge-mapper**.

3.  **Open the Macro for Editing:**
    *   Find the macro named `get_knowledge_graph` and click **Edit**.

4.  **Update the Macro Definition:**
    *   In the "Definition" text box, replace the existing search with your own SPL query.
    *   Your search must transform your data into the required format (see below).

5.  **Save the Macro:**
    *   Click **Save**. The application will now use your data.

## Required Data Format

Your search **must** output a table where each row represents a single **relationship (edge)** and includes the full details for both its **source entity (node)** and **target entity (node)**.

The following fields are required:

| Field Name         | Type   | Description                                           | Example                                  |
| ------------------ | ------ | ----------------------------------------------------- | ---------------------------------------- |
| `id`               | string | A unique ID for the relationship.                     | `rel_123`                                |
| `source`           | string | The unique ID of the source entity.                   | `userX`                                  |
| `target`           | string | The unique ID of the target entity.                   | `hostZ`                                  |
| `label`            | string | The display label for the relationship.               | `logged_onto`                            |
| `isAnomaly`        | bool   | `true` or `false`. Set to true to highlight the edge. | `true`                                   |
| `details`          | string | A JSON string of key-value pairs for the relationship.  | `{"port": 443, "protocol": "TCP"}`       |
| `source_label`     | string | The display label for the source entity.              | `User X (userX@example.com)`             |
| `source_type`      | string | The entity type (`user`, `host`, `ip`).               | `user`                                   |
| `source_details`   | string | A JSON string of key-value pairs for the source entity. | `{"department": "Sales"}`                |
| `target_label`     | string | The display label for the target entity.              | `Host Z (srv-web-01)`                    |
| `target_type`      | string | The entity type (`user`, `host`, `ip`).               | `host`                                   |
| `target_details`   | string | A JSON string of key-value pairs for the target entity. | `{"os": "Linux"}`                        |

### Example SPL Query (using Authentication data model)

Here is an example of how you might query the CIM `Authentication` data model and format the results. You can use this as a template.

```spl
| tstats `summariesonly` values(Authentication.src) as src, values(Authentication.user) as user, values(Authentication.action) as action from datamodel=Authentication by Authentication.dest
| rename Authentication.* as *
| where isnotnull(user) AND isnotnull(dest)
| mvexpand user
| mvexpand dest
| eval source = user, target = dest, label = action
| eval id = source."-".target."-".label
| eval source_type="user", target_type="host"
| eval source_label = source, target_label = target
| eval details = "{}", source_details = "{}", target_details = "{}"
| eval isAnomaly = if(action="failure", "true", "false")
| table id, source, target, label, isAnomaly, details, source_type, source_label, source_details, target_type, target_label, target_details
``` 