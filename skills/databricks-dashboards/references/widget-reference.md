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

---

## Bar Chart

```json
{
  "widget": {
    "name": "bar_chart_1",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "dataset_name",
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
        "title": "Chart Title",
        "showTitle": true
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
    "name": "line_chart_1",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "time_series_data",
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
    "name": "area_chart_1",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "trend_data",
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
    "name": "pie_chart_1",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "distribution_data",
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
      }
    }
  },
  "position": {"x": 0, "y": 0, "width": 4, "height": 4}
}
```

---

## Counter

Single value display:

```json
{
  "widget": {
    "name": "counter_1",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "summary_data",
        "fields": [
          {"name": "total", "expression": "SUM(`amount`)"}
        ],
        "disaggregated": false
      }
    }],
    "spec": {
      "version": 3,
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

```json
{
  "widget": {
    "name": "table_1",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "detail_data",
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
      "version": 3,
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
  "version": 3,
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
    "name": "scatter_1",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "correlation_data",
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
    "name": "heatmap_1",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "matrix_data",
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
    "name": "combo_1",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "combo_data",
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
    "name": "pivot_1",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "pivot_data",
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
    "name": "date_filter",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "main_data",
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
    "name": "category_filter",
    "queries": [{
      "name": "main",
      "query": {
        "datasetName": "filter_options",
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
    "name": "text_header",
    "textbox_spec": "# Dashboard Title\n\n**Description:** This dashboard shows key metrics.\n\n- Item 1\n- Item 2"
  },
  "position": {"x": 0, "y": 0, "width": 12, "height": 2}
}
```

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
