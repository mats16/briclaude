---
name: databricks-dashboards
description: |
  Create Databricks AI/BI dashboard JSON files in lvdash.json format.
  Triggers: create dashboard, dashboard JSON, lvdash.json, visualization dashboard, BI dashboard, build dashboard, dashboard definition, widget layout.
---

# Databricks Dashboards

## Overview

AI/BI dashboards (formerly Lakeview dashboards) are defined in `.lvdash.json` files.

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

## Naming Conventions

| Element | Format | Example |
|---------|--------|---------|
| Page name | 8-char hex ID | `a1b2c3d4` |
| Widget name | 8-char hex ID | `e5f6a7b8` |
| Dataset name | 8-char hex ID | `01f0ac3f` |
| Query name | `dashboards/{dashboard_id}/datasets/{dataset_id}_{description}` | `dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ac3f065f117db5bbc92371902e11_group_key` |

Parameter queries use `parameter_` prefix:
- `parameter_dashboards/{dashboard_id}/datasets/{dataset_id}_{param_name}`

Generate hex IDs: `crypto.randomBytes(4).toString('hex')` or `openssl rand -hex 4`

## Quick Start

### Minimal Dashboard

```json
{
  "datasets": [
    {
      "name": "01f0ac3f",
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
            "name": "e5f6a7b8",
            "queries": [
              {
                "name": "dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ac3f065f117db5bbc92371902e11_sales_chart",
                "query": {
                  "datasetName": "01f0ac3f",
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
              },
              "frame": {"showTitle": true, "title": "Daily Revenue"}
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

Define SQL queries that power visualizations. Use 8-character hex ID for `name`:

```json
{
  "name": "01f0ac3f",
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

| Type | `widgetType` | Encodings | spec.version |
|------|--------------|-----------|--------------|
| Bar | `bar` | x, y, color | 3 |
| Line | `line` | x, y, color | 3 |
| Area | `area` | x, y, color | 3 |
| Pie | `pie` | label, value | 3 |
| Scatter | `scatter` | x, y, color | 3 |
| Heatmap | `heatmap` | x, y, color | 3 |
| Histogram | `histogram` | x | 3 |
| Combo | `combo` | x, y, y2 | 3 |
| Pivot | `pivot` | rows, columns, values | 3 |
| Filter | `filter-*` | (varies) | 3 |
| Counter | `counter` | value | 2 |
| Table | `table` | columns | 1 |

**Note:** Counter and Table require older spec versions (2 and 1 respectively).

For detailed widget specifications: See [Widget Reference](references/widget-reference.md)

## Common Patterns

### Counter Widget (spec.version: 2)

```json
{
  "widget": {
    "name": "c1d2e3f4",
    "queries": [{
      "name": "dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ab72463012345678901234567890_total_counter",
      "query": {
        "datasetName": "01f0ab72",
        "fields": [{"name": "total", "expression": "SUM(`amount`)"}],
        "disaggregated": false
      }
    }],
    "spec": {
      "version": 2,
      "widgetType": "counter",
      "encodings": {
        "value": {"fieldName": "total", "displayName": "Total Amount"}
      },
      "frame": {"showTitle": true, "title": "Total Amount"}
    }
  },
  "position": {"x": 0, "y": 0, "width": 3, "height": 2}
}
```

### Date Range Filter

```json
{
  "widget": {
    "name": "f1a2b3c4",
    "queries": [{
      "name": "parameter_dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ab724630173fb05934717b44e451_param_date_range",
      "query": {
        "datasetName": "01f0ab72",
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
    "name": "d4e5f6a7",
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

## Validation

Validate dashboard JSON to catch errors early:

```bash
# Syntax check
jq empty dashboard.lvdash.json

# Verify required structure
jq '{
  datasets: (.datasets | length),
  pages: [.pages[] | {name, displayName, widgets: (.layout | length)}]
}' dashboard.lvdash.json

# List all dataset names (for debugging references)
jq -r '.datasets[].name' dashboard.lvdash.json

# Check widget-dataset references
jq -r '.pages[].layout[].widget.queries[]?.query.datasetName // empty' dashboard.lvdash.json | sort -u
```

**Common errors:**
- Missing `datasets` array
- Widget referencing non-existent dataset name (must match 8-char hex ID in datasets)
- Invalid page/widget/dataset name format (must be 8-char hex, e.g., `a1b2c3d4`)
- Missing required encoding fields for widget type

## Required Rules

1. **8-char hex IDs** - Required for page name, widget name, and dataset name/datasetName
2. **Query name format** - Must follow `dashboards/{dashboard_id}/datasets/{dataset_id}_{description}` pattern
3. **Parameter prefix** - Filter widget queries must use `parameter_` prefix
4. **spec.version** - Counter requires version 2, Table requires version 1, all others use version 3
5. **Frame with title** - Always set `spec.frame` with `showTitle: true` and `title`. Widgets without titles severely degrade dashboard readability

## Tips

- **Grid layout** - 12 columns total, plan widget positions carefully
- **Test incrementally** - Import after adding each component to catch errors early
- **Use `disaggregated: false`** for aggregations, `true` for raw field access

## References

- [Widget Reference](references/widget-reference.md): Complete widget specifications
- [Examples](references/examples.md): Full dashboard examples
