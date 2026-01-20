---
name: databricks-dashboards
version: 1.0.0
description: |
  Create and manage Databricks AI/BI dashboards using lvdash.json format.
  Triggers: create dashboard, dashboard JSON, lvdash.json, visualization dashboard, BI dashboard, build dashboard, dashboard definition, widget layout.
  Outputs dashboard definition files that can be imported via Databricks CLI or API.
---

# Databricks Dashboards

## Overview

AI/BI dashboards (formerly Lakeview dashboards) are defined in `.lvdash.json` files. Export and import via CLI or API.

## File Format

Dashboard files use `.lvdash.json` extension. The structure:

```json
{
  "datasets": [...],
  "pages": [
    {
      "name": "<8-char-id>",
      "displayName": "Page Title",
      "layout": [...]
    }
  ]
}
```

## Quick Start

### Minimal Dashboard

```json
{
  "datasets": [
    {
      "name": "sales_data",
      "displayName": "Sales Data",
      "query": "SELECT date, revenue FROM catalog.schema.sales"
    }
  ],
  "pages": [
    {
      "name": "a1b2c3d4",
      "displayName": "Sales Overview",
      "layout": [
        {
          "widget": {
            "name": "w1",
            "queries": [
              {
                "name": "main",
                "query": {
                  "datasetName": "sales_data",
                  "fields": [
                    {"name": "date", "expression": "`date`"},
                    {"name": "revenue", "expression": "SUM(`revenue`)"}
                  ],
                  "disaggregated": false
                }
              }
            ],
            "spec": {
              "version": 3,
              "widgetType": "bar",
              "encodings": {
                "x": {"fieldName": "date", "scale": {"type": "categorical"}, "displayName": "Date"},
                "y": {"fieldName": "revenue", "scale": {"type": "quantitative"}, "displayName": "Revenue"}
              }
            }
          },
          "position": {"x": 0, "y": 0, "width": 6, "height": 4}
        }
      ]
    }
  ]
}
```

## Structure Reference

### Datasets

Define SQL queries that power visualizations:

```json
{
  "name": "unique_id",
  "displayName": "Human Readable Name",
  "query": "SELECT col1, col2 FROM catalog.schema.table WHERE ..."
}
```

### Pages

Pages contain layouts with widgets. Use 8-character hex IDs:

```json
{
  "name": "a1b2c3d4",
  "displayName": "Dashboard Page Title",
  "layout": [...]
}
```

### Widget Position

Grid-based layout (12 columns total):

```json
{
  "position": {
    "x": 0,      // 0-11 (column position)
    "y": 0,      // Row position (starts at 0)
    "width": 6,  // 1-12 (columns to span)
    "height": 4  // Rows to span
  }
}
```

### Widget Types

| Type | `widgetType` | Encodings |
|------|--------------|-----------|
| Bar | `bar` | x, y, color |
| Line | `line` | x, y, color |
| Area | `area` | x, y, color |
| Pie | `pie` | label, value |
| Counter | `counter` | value |
| Table | `table` | columns |
| Scatter | `scatter` | x, y, color |
| Heatmap | `heatmap` | x, y, color |
| Histogram | `histogram` | x |
| Combo | `combo` | x, y, y2 |
| Pivot | `pivot` | rows, columns, values |
| Filter | `filter-*` | (varies) |
| Text | `text` | textbox_spec |

For detailed widget specifications: See [Widget Reference](references/widget-reference.md)

## Common Patterns

### Counter Widget

```json
{
  "widget": {
    "name": "total_counter",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "summary_data",
        "fields": [{"name": "total", "expression": "SUM(`amount`)"}],
        "disaggregated": false
      }
    }],
    "spec": {
      "version": 3,
      "widgetType": "counter",
      "encodings": {
        "value": {"fieldName": "total", "displayName": "Total Amount"}
      }
    }
  },
  "position": {"x": 0, "y": 0, "width": 3, "height": 2}
}
```

### Date Range Filter

```json
{
  "widget": {
    "name": "date_filter",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "main_data",
        "fields": [{"name": "date", "expression": "`date`"}],
        "disaggregated": true
      }
    }],
    "spec": {
      "version": 3,
      "widgetType": "filter-date-range-picker",
      "encodings": {
        "fields": {"fieldName": "date", "displayName": "Date Range"}
      }
    }
  },
  "position": {"x": 0, "y": 0, "width": 3, "height": 1}
}
```

### Text/Markdown Widget

```json
{
  "widget": {
    "name": "title_text",
    "textbox_spec": "# Dashboard Title\n\nDescription text here."
  },
  "position": {"x": 0, "y": 0, "width": 12, "height": 1}
}
```

## Encodings Structure

### Quantitative Fields (measures)

```json
{
  "y": {
    "fieldName": "revenue",
    "scale": {"type": "quantitative"},
    "displayName": "Revenue ($)"
  }
}
```

### Categorical Fields (dimensions)

```json
{
  "x": {
    "fieldName": "category",
    "scale": {"type": "categorical"},
    "displayName": "Category"
  }
}
```

### Color Encoding

```json
{
  "color": {
    "fieldName": "region",
    "scale": {"type": "categorical"},
    "displayName": "Region"
  }
}
```

## Import/Export

### Export via CLI

```bash
databricks workspace export /Workspace/path/to/dashboard.lvdash.json ./local.lvdash.json
```

### Import via CLI

```bash
databricks workspace import ./dashboard.lvdash.json /Workspace/Users/user@example.com/dashboards/my_dashboard.lvdash.json --format AUTO
```

### Bundle Configuration

```yaml
resources:
  dashboards:
    my_dashboard:
      display_name: "My Dashboard"
      file_path: ./src/my_dashboard.lvdash.json
      warehouse_id: ${var.warehouse_id}
```

## Best Practices

1. **Use meaningful dataset names** - Referenced in widgets
2. **8-char hex IDs for pages/widgets** - Generate with `crypto.randomBytes(4).toString('hex')`
3. **Grid layout** - 12 columns, plan widget positions carefully
4. **Test incrementally** - Import after adding each component
5. **Use `disaggregated: false`** for aggregations, `true` for raw field access

## References

- [Widget Reference](references/widget-reference.md): Complete widget specifications
- [Examples](references/examples.md): Full dashboard examples
