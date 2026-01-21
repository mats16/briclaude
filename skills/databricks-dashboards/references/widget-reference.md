# Widget Reference

Complete specifications for each widget type.

## Table of Contents

1. [Bar Chart](#bar-chart)
2. [Line Chart](#line-chart)
3. [Area Chart](#area-chart)
4. [Pie Chart](#pie-chart)
5. [Counter](#counter)
6. [Table](#table)
7. [Scatter Plot](#scatter-plot)
8. [Heatmap](#heatmap)
9. [Combo Chart](#combo-chart)
10. [Pivot Table](#pivot-table)
11. [Filters](#filters)
12. [Text Widget](#text-widget)
13. [Frame Structure](#frame-structure)
14. [Scale Types](#scale-types)
15. [Expression Functions](#expression-functions)

---

## Bar Chart

```json
{
  "widget": {
    "name": "b1a2c3d4",
    "queries": [{
      "name": "dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ac3f065f117db5bbc92371902e11_bar_chart",
      "query": {
        "datasetName": "01f0ac3f",
        "fields": [
          {"name": "category", "expression": "`category_column`"},
          {"name": "value", "expression": "SUM(`value_column`)"}
        ],
        "disaggregated": false
      }
    }],
    "spec": {
      "version": 3,
      "widgetType": "bar",
      "encodings": {
        "x": {"fieldName": "category", "scale": {"type": "categorical"}, "displayName": "Category"},
        "y": {"fieldName": "value", "scale": {"type": "quantitative"}, "displayName": "Value"}
      },
      "frame": {
        "showTitle": true,
        "title": "Bar Chart Title"
      }
    }
  },
  "position": {"x": 0, "y": 0, "width": 6, "height": 4}
}
```

### With Color Grouping

```json
"encodings": {
  "x": {"fieldName": "category", "scale": {"type": "categorical"}, "displayName": "Category"},
  "y": {"fieldName": "value", "scale": {"type": "quantitative"}, "displayName": "Value"},
  "color": {"fieldName": "group", "scale": {"type": "categorical"}, "displayName": "Group"}
}
```

---

## Line Chart

```json
{
  "widget": {
    "name": "l1e2n3e4",
    "queries": [{
      "name": "dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ac3f065f117db5bbc92371902e12_line_chart",
      "query": {
        "datasetName": "01f0ac3f",
        "fields": [
          {"name": "date", "expression": "DATE_TRUNC('DAY', `timestamp`)"},
          {"name": "metric", "expression": "AVG(`metric_column`)"}
        ],
        "disaggregated": false
      }
    }],
    "spec": {
      "version": 3,
      "widgetType": "line",
      "encodings": {
        "x": {"fieldName": "date", "scale": {"type": "temporal"}, "displayName": "Date"},
        "y": {"fieldName": "metric", "scale": {"type": "quantitative"}, "displayName": "Metric"}
      },
      "frame": {
        "showTitle": true,
        "title": "Line Chart Title"
      }
    }
  },
  "position": {"x": 0, "y": 0, "width": 6, "height": 4}
}
```

---

## Area Chart

```json
{
  "widget": {
    "name": "a1r2e3a4",
    "queries": [{
      "name": "dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ac3f065f117db5bbc92371902e13_area_chart",
      "query": {
        "datasetName": "01f0ac3f",
        "fields": [
          {"name": "date", "expression": "`date`"},
          {"name": "value", "expression": "SUM(`value`)"},
          {"name": "category", "expression": "`category`"}
        ],
        "disaggregated": false
      }
    }],
    "spec": {
      "version": 3,
      "widgetType": "area",
      "encodings": {
        "x": {"fieldName": "date", "scale": {"type": "temporal"}, "displayName": "Date"},
        "y": {"fieldName": "value", "scale": {"type": "quantitative"}, "displayName": "Value"},
        "color": {"fieldName": "category", "scale": {"type": "categorical"}, "displayName": "Category"}
      },
      "frame": {
        "showTitle": true,
        "title": "Area Chart Title"
      }
    }
  },
  "position": {"x": 0, "y": 0, "width": 6, "height": 4}
}
```

---

## Pie Chart

```json
{
  "widget": {
    "name": "p1i2e3c4",
    "queries": [{
      "name": "dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ac3f065f117db5bbc92371902e14_pie_chart",
      "query": {
        "datasetName": "01f0ac3f",
        "fields": [
          {"name": "category", "expression": "`category`"},
          {"name": "value", "expression": "SUM(`amount`)"}
        ],
        "disaggregated": false
      }
    }],
    "spec": {
      "version": 3,
      "widgetType": "pie",
      "encodings": {
        "label": {"fieldName": "category", "displayName": "Category"},
        "value": {"fieldName": "value", "displayName": "Amount"}
      },
      "frame": {
        "showTitle": true,
        "title": "Pie Chart Title"
      }
    }
  },
  "position": {"x": 0, "y": 0, "width": 4, "height": 4}
}
```

---

## Counter

Single value display. **Note: Counter uses spec.version 2.**

```json
{
  "widget": {
    "name": "c1d2e3f4",
    "queries": [{
      "name": "dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ab72463012345678901234567890_total_counter",
      "query": {
        "datasetName": "01f0ab72",
        "fields": [
          {"name": "total", "expression": "SUM(`amount`)"}
        ],
        "disaggregated": false
      }
    }],
    "spec": {
      "version": 2,
      "widgetType": "counter",
      "encodings": {
        "value": {"fieldName": "total", "displayName": "Total Amount"}
      },
      "frame": {
        "title": "Total Revenue",
        "showTitle": true
      }
    }
  },
  "position": {"x": 0, "y": 0, "width": 3, "height": 2}
}
```

### Counter with Row Count

```json
"fields": [{"name": "count", "expression": "COUNT(*)"}]
```

---

## Table

**Note: Table uses spec.version 1.**

```json
{
  "widget": {
    "name": "a1b2c3d4",
    "queries": [{
      "name": "dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ab72463012345678901234567891_detail_table",
      "query": {
        "datasetName": "01f0ab72",
        "fields": [
          {"name": "id", "expression": "`id`"},
          {"name": "name", "expression": "`name`"},
          {"name": "value", "expression": "`value`"},
          {"name": "date", "expression": "`created_at`"}
        ],
        "disaggregated": true
      }
    }],
    "spec": {
      "version": 1,
      "widgetType": "table",
      "encodings": {
        "columns": [
          {"fieldName": "id", "displayName": "ID"},
          {"fieldName": "name", "displayName": "Name"},
          {"fieldName": "value", "displayName": "Value"},
          {"fieldName": "date", "displayName": "Date"}
        ]
      },
      "frame": {
        "title": "Data Table",
        "showTitle": true
      }
    }
  },
  "position": {"x": 0, "y": 0, "width": 12, "height": 6}
}
```

### Table with Conditional Formatting

```json
"spec": {
  "version": 1,
  "widgetType": "table",
  "encodings": {
    "columns": [
      {"fieldName": "name", "displayName": "Name"},
      {
        "fieldName": "status",
        "displayName": "Status",
        "colorMode": "text",
        "conditions": [
          {"condition": {"operator": "=", "value": "SUCCESS"}, "color": "#00A972"},
          {"condition": {"operator": "=", "value": "FAILED"}, "color": "#FF3621"}
        ]
      }
    ]
  }
}
```

---

## Scatter Plot

```json
{
  "widget": {
    "name": "s1c2a3t4",
    "queries": [{
      "name": "dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ac3f065f117db5bbc92371902e15_scatter_plot",
      "query": {
        "datasetName": "01f0ac3f",
        "fields": [
          {"name": "x_val", "expression": "`metric_x`"},
          {"name": "y_val", "expression": "`metric_y`"},
          {"name": "category", "expression": "`category`"}
        ],
        "disaggregated": true
      }
    }],
    "spec": {
      "version": 3,
      "widgetType": "scatter",
      "encodings": {
        "x": {"fieldName": "x_val", "scale": {"type": "quantitative"}, "displayName": "Metric X"},
        "y": {"fieldName": "y_val", "scale": {"type": "quantitative"}, "displayName": "Metric Y"},
        "color": {"fieldName": "category", "scale": {"type": "categorical"}, "displayName": "Category"}
      },
      "frame": {
        "showTitle": true,
        "title": "Scatter Plot Title"
      }
    }
  },
  "position": {"x": 0, "y": 0, "width": 6, "height": 4}
}
```

---

## Heatmap

```json
{
  "widget": {
    "name": "h1e2a3t4",
    "queries": [{
      "name": "dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ac3f065f117db5bbc92371902e16_heatmap",
      "query": {
        "datasetName": "01f0ac3f",
        "fields": [
          {"name": "x_dim", "expression": "`dimension_x`"},
          {"name": "y_dim", "expression": "`dimension_y`"},
          {"name": "intensity", "expression": "SUM(`value`)"}
        ],
        "disaggregated": false
      }
    }],
    "spec": {
      "version": 3,
      "widgetType": "heatmap",
      "encodings": {
        "x": {"fieldName": "x_dim", "scale": {"type": "categorical"}, "displayName": "X Dimension"},
        "y": {"fieldName": "y_dim", "scale": {"type": "categorical"}, "displayName": "Y Dimension"},
        "color": {"fieldName": "intensity", "scale": {"type": "quantitative"}, "displayName": "Intensity"}
      },
      "frame": {
        "showTitle": true,
        "title": "Heatmap Title"
      }
    }
  },
  "position": {"x": 0, "y": 0, "width": 6, "height": 4}
}
```

---

## Combo Chart

Bar and line on the same chart:

```json
{
  "widget": {
    "name": "c1o2m3b4",
    "queries": [{
      "name": "dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ac3f065f117db5bbc92371902e17_combo_chart",
      "query": {
        "datasetName": "01f0ac3f",
        "fields": [
          {"name": "month", "expression": "`month`"},
          {"name": "revenue", "expression": "SUM(`revenue`)"},
          {"name": "growth_rate", "expression": "AVG(`growth_rate`)"}
        ],
        "disaggregated": false
      }
    }],
    "spec": {
      "version": 3,
      "widgetType": "combo",
      "encodings": {
        "x": {"fieldName": "month", "scale": {"type": "categorical"}, "displayName": "Month"},
        "y": {"fieldName": "revenue", "scale": {"type": "quantitative"}, "displayName": "Revenue", "seriesType": "bar"},
        "y2": {"fieldName": "growth_rate", "scale": {"type": "quantitative"}, "displayName": "Growth Rate", "seriesType": "line"}
      },
      "frame": {
        "showTitle": true,
        "title": "Combo Chart Title"
      }
    }
  },
  "position": {"x": 0, "y": 0, "width": 6, "height": 4}
}
```

---

## Pivot Table

```json
{
  "widget": {
    "name": "p1v2o3t4",
    "queries": [{
      "name": "dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ac3f065f117db5bbc92371902e18_pivot_table",
      "query": {
        "datasetName": "01f0ac3f",
        "fields": [
          {"name": "row_dim", "expression": "`category`"},
          {"name": "col_dim", "expression": "`region`"},
          {"name": "measure", "expression": "SUM(`sales`)"}
        ],
        "disaggregated": false
      }
    }],
    "spec": {
      "version": 3,
      "widgetType": "pivot",
      "encodings": {
        "rows": [{"fieldName": "row_dim", "displayName": "Category"}],
        "columns": [{"fieldName": "col_dim", "displayName": "Region"}],
        "values": [{"fieldName": "measure", "displayName": "Sales"}]
      },
      "frame": {
        "showTitle": true,
        "title": "Pivot Table Title"
      }
    }
  },
  "position": {"x": 0, "y": 0, "width": 8, "height": 5}
}
```

---

## Filters

### Date Range Picker

```json
{
  "widget": {
    "name": "f1d2r3p4",
    "queries": [{
      "name": "parameter_dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ac3f065f117db5bbc92371902e19_param_date",
      "query": {
        "datasetName": "01f0ac3f",
        "fields": [{"name": "date", "expression": "`date_column`"}],
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

### Multi-Select Filter

```json
{
  "widget": {
    "name": "f1m2s3f4",
    "queries": [{
      "name": "parameter_dashboards/01f0a403a6891cc1b5cf06c4960354b8/datasets/01f0ac3f065f117db5bbc92371902e20_param_category",
      "query": {
        "datasetName": "01f0ac3f",
        "fields": [{"name": "category", "expression": "`category`"}],
        "disaggregated": true
      }
    }],
    "spec": {
      "version": 3,
      "widgetType": "filter-multi-select",
      "encodings": {
        "fields": {"fieldName": "category", "displayName": "Category"}
      }
    }
  },
  "position": {"x": 3, "y": 0, "width": 3, "height": 1}
}
```

### Single-Select Filter

```json
"widgetType": "filter-single-select"
```

---

## Text Widget

Markdown-enabled text display:

```json
{
  "widget": {
    "name": "t1e2x3t4",
    "textbox_spec": "# Dashboard Title\n\n**Description:** This dashboard shows key metrics.\n\n- Item 1\n- Item 2"
  },
  "position": {"x": 0, "y": 0, "width": 12, "height": 2}
}
```

---

## Frame Structure

Widget title and description configuration.

**Important:** `title` and `showTitle: true` are practically required. Widgets without titles make it difficult to understand their content and severely degrade dashboard readability.

```json
"frame": {
  "showTitle": true,
  "title": "Widget Title",
  "showDescription": true,
  "description": "Optional description text displayed below the title."
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `showTitle` | boolean | **Yes** | Always set to `true` |
| `title` | string | **Yes** | Title describing widget content |
| `showDescription` | boolean | No | Show/hide the description |
| `description` | string | No | Description text (displayed below title) |

---

## Scale Types

| Scale Type | Use For |
|------------|---------|
| `quantitative` | Numeric measures (sums, averages, counts) |
| `categorical` | Discrete categories (names, IDs) |
| `temporal` | Dates and timestamps |

---

## Expression Functions

Common SQL expressions for fields:

| Function | Example |
|----------|---------|
| Direct reference | `` `column_name` `` |
| Sum | `SUM(\`amount\`)` |
| Count | `COUNT(*)` |
| Average | `AVG(\`value\`)` |
| Min/Max | `MIN(\`date\`)`, `MAX(\`date\`)` |
| Date truncate | `DATE_TRUNC('DAY', \`timestamp\`)` |
| Conditional | `CASE WHEN \`status\` = 'A' THEN 1 ELSE 0 END` |
