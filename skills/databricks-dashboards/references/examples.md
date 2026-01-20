# Dashboard Examples

Complete dashboard examples for common use cases.

## Table of Contents

1. [Sales Dashboard](#sales-dashboard)
2. [Job Monitoring Dashboard](#job-monitoring-dashboard)
3. [Cost Analysis Dashboard](#cost-analysis-dashboard)

---

## Sales Dashboard

A complete sales analytics dashboard with filters, counters, and charts.

```json
{
  "datasets": [
    {
      "name": "sales_summary",
      "displayName": "Sales Summary",
      "query": "SELECT DATE_TRUNC('day', order_date) as date, region, product_category, SUM(revenue) as revenue, COUNT(*) as order_count FROM catalog.schema.orders WHERE order_date >= CURRENT_DATE - INTERVAL 90 DAYS GROUP BY 1, 2, 3"
    },
    {
      "name": "top_products",
      "displayName": "Top Products",
      "query": "SELECT product_name, SUM(revenue) as total_revenue, SUM(quantity) as total_quantity FROM catalog.schema.order_items WHERE order_date >= CURRENT_DATE - INTERVAL 30 DAYS GROUP BY 1 ORDER BY 2 DESC LIMIT 10"
    }
  ],
  "pages": [
    {
      "name": "a1b2c3d4",
      "displayName": "Sales Overview",
      "layout": [
        {
          "widget": {
            "name": "title",
            "textbox_spec": "# Sales Dashboard\n\nReal-time sales performance metrics"
          },
          "position": {"x": 0, "y": 0, "width": 12, "height": 1}
        },
        {
          "widget": {
            "name": "date_filter",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "sales_summary",
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
          "position": {"x": 0, "y": 1, "width": 3, "height": 1}
        },
        {
          "widget": {
            "name": "region_filter",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "sales_summary",
                "fields": [{"name": "region", "expression": "`region`"}],
                "disaggregated": true
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "filter-multi-select",
              "encodings": {
                "fields": {"fieldName": "region", "displayName": "Region"}
              }
            }
          },
          "position": {"x": 3, "y": 1, "width": 3, "height": 1}
        },
        {
          "widget": {
            "name": "total_revenue",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "sales_summary",
                "fields": [{"name": "total", "expression": "SUM(`revenue`)"}],
                "disaggregated": false
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "counter",
              "encodings": {
                "value": {"fieldName": "total", "displayName": "Total Revenue"}
              },
              "frame": {"title": "Total Revenue", "showTitle": true}
            }
          },
          "position": {"x": 0, "y": 2, "width": 3, "height": 2}
        },
        {
          "widget": {
            "name": "total_orders",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "sales_summary",
                "fields": [{"name": "count", "expression": "SUM(`order_count`)"}],
                "disaggregated": false
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "counter",
              "encodings": {
                "value": {"fieldName": "count", "displayName": "Total Orders"}
              },
              "frame": {"title": "Total Orders", "showTitle": true}
            }
          },
          "position": {"x": 3, "y": 2, "width": 3, "height": 2}
        },
        {
          "widget": {
            "name": "revenue_trend",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "sales_summary",
                "fields": [
                  {"name": "date", "expression": "`date`"},
                  {"name": "revenue", "expression": "SUM(`revenue`)"}
                ],
                "disaggregated": false
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "line",
              "encodings": {
                "x": {"fieldName": "date", "scale": {"type": "temporal"}, "displayName": "Date"},
                "y": {"fieldName": "revenue", "scale": {"type": "quantitative"}, "displayName": "Revenue"}
              },
              "frame": {"title": "Revenue Trend", "showTitle": true}
            }
          },
          "position": {"x": 6, "y": 2, "width": 6, "height": 4}
        },
        {
          "widget": {
            "name": "revenue_by_region",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "sales_summary",
                "fields": [
                  {"name": "region", "expression": "`region`"},
                  {"name": "revenue", "expression": "SUM(`revenue`)"}
                ],
                "disaggregated": false
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "bar",
              "encodings": {
                "x": {"fieldName": "region", "scale": {"type": "categorical"}, "displayName": "Region"},
                "y": {"fieldName": "revenue", "scale": {"type": "quantitative"}, "displayName": "Revenue"}
              },
              "frame": {"title": "Revenue by Region", "showTitle": true}
            }
          },
          "position": {"x": 0, "y": 4, "width": 6, "height": 4}
        },
        {
          "widget": {
            "name": "top_products_table",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "top_products",
                "fields": [
                  {"name": "product", "expression": "`product_name`"},
                  {"name": "revenue", "expression": "`total_revenue`"},
                  {"name": "quantity", "expression": "`total_quantity`"}
                ],
                "disaggregated": true
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "table",
              "encodings": {
                "columns": [
                  {"fieldName": "product", "displayName": "Product"},
                  {"fieldName": "revenue", "displayName": "Revenue"},
                  {"fieldName": "quantity", "displayName": "Quantity"}
                ]
              },
              "frame": {"title": "Top 10 Products", "showTitle": true}
            }
          },
          "position": {"x": 6, "y": 6, "width": 6, "height": 4}
        }
      ]
    }
  ]
}
```

---

## Job Monitoring Dashboard

Monitor Databricks job runs and failures.

```json
{
  "datasets": [
    {
      "name": "job_runs",
      "displayName": "Job Runs",
      "query": "SELECT j.name as job_name, r.run_id, r.result_state, r.period_start_time, r.period_end_time, TIMESTAMPDIFF(MINUTE, r.period_start_time, r.period_end_time) as duration_min FROM system.lakeflow.job_run_timeline r JOIN system.lakeflow.jobs j USING (job_id) WHERE r.period_start_time >= CURRENT_DATE - INTERVAL 7 DAYS"
    },
    {
      "name": "job_stats",
      "displayName": "Job Statistics",
      "query": "SELECT j.name as job_name, r.result_state, COUNT(*) as run_count FROM system.lakeflow.job_run_timeline r JOIN system.lakeflow.jobs j USING (job_id) WHERE r.period_start_time >= CURRENT_DATE - INTERVAL 7 DAYS GROUP BY 1, 2"
    }
  ],
  "pages": [
    {
      "name": "e5f6g7h8",
      "displayName": "Job Monitoring",
      "layout": [
        {
          "widget": {
            "name": "header",
            "textbox_spec": "# Job Monitoring Dashboard\n\nLast 7 days of job execution data"
          },
          "position": {"x": 0, "y": 0, "width": 12, "height": 1}
        },
        {
          "widget": {
            "name": "total_runs",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "job_runs",
                "fields": [{"name": "count", "expression": "COUNT(*)"}],
                "disaggregated": false
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "counter",
              "encodings": {
                "value": {"fieldName": "count", "displayName": "Total Runs"}
              },
              "frame": {"title": "Total Runs", "showTitle": true}
            }
          },
          "position": {"x": 0, "y": 1, "width": 3, "height": 2}
        },
        {
          "widget": {
            "name": "failed_runs",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "job_runs",
                "fields": [{"name": "count", "expression": "COUNT(CASE WHEN `result_state` = 'FAILED' THEN 1 END)"}],
                "disaggregated": false
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "counter",
              "encodings": {
                "value": {"fieldName": "count", "displayName": "Failed Runs"}
              },
              "frame": {"title": "Failed Runs", "showTitle": true}
            }
          },
          "position": {"x": 3, "y": 1, "width": 3, "height": 2}
        },
        {
          "widget": {
            "name": "success_rate",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "job_runs",
                "fields": [{"name": "rate", "expression": "ROUND(100.0 * SUM(CASE WHEN `result_state` = 'SUCCESS' THEN 1 ELSE 0 END) / COUNT(*), 1)"}],
                "disaggregated": false
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "counter",
              "encodings": {
                "value": {"fieldName": "rate", "displayName": "Success Rate %"}
              },
              "frame": {"title": "Success Rate (%)", "showTitle": true}
            }
          },
          "position": {"x": 6, "y": 1, "width": 3, "height": 2}
        },
        {
          "widget": {
            "name": "status_breakdown",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "job_stats",
                "fields": [
                  {"name": "status", "expression": "`result_state`"},
                  {"name": "count", "expression": "SUM(`run_count`)"}
                ],
                "disaggregated": false
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "pie",
              "encodings": {
                "label": {"fieldName": "status", "displayName": "Status"},
                "value": {"fieldName": "count", "displayName": "Count"}
              },
              "frame": {"title": "Run Status Distribution", "showTitle": true}
            }
          },
          "position": {"x": 9, "y": 1, "width": 3, "height": 3}
        },
        {
          "widget": {
            "name": "recent_failures",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "job_runs",
                "fields": [
                  {"name": "job", "expression": "`job_name`"},
                  {"name": "run_id", "expression": "`run_id`"},
                  {"name": "time", "expression": "`period_start_time`"},
                  {"name": "status", "expression": "`result_state`"}
                ],
                "disaggregated": true
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "table",
              "encodings": {
                "columns": [
                  {"fieldName": "job", "displayName": "Job Name"},
                  {"fieldName": "run_id", "displayName": "Run ID"},
                  {"fieldName": "time", "displayName": "Start Time"},
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
              },
              "frame": {"title": "Recent Job Runs", "showTitle": true}
            }
          },
          "position": {"x": 0, "y": 3, "width": 9, "height": 5}
        }
      ]
    }
  ]
}
```

---

## Cost Analysis Dashboard

Analyze Databricks billing and costs.

```json
{
  "datasets": [
    {
      "name": "daily_costs",
      "displayName": "Daily Costs",
      "query": "WITH prices AS (SELECT sku_name, usage_unit, pricing, DATE(price_start_time) AS start_date, DATE(COALESCE(price_end_time, '9999-12-31')) AS end_date FROM system.billing.list_prices) SELECT u.usage_date, u.sku_name, SUM(u.usage_quantity) as dbu, SUM(u.usage_quantity * p.pricing.default) as cost FROM system.billing.usage u LEFT JOIN prices p ON u.sku_name = p.sku_name AND u.usage_unit = p.usage_unit AND u.usage_date >= p.start_date AND u.usage_date < p.end_date WHERE u.usage_date >= CURRENT_DATE - INTERVAL 30 DAYS GROUP BY 1, 2 HAVING SUM(u.usage_quantity) != 0"
    },
    {
      "name": "sku_summary",
      "displayName": "SKU Summary",
      "query": "WITH prices AS (SELECT sku_name, usage_unit, pricing, DATE(price_start_time) AS start_date, DATE(COALESCE(price_end_time, '9999-12-31')) AS end_date FROM system.billing.list_prices) SELECT u.sku_name, SUM(u.usage_quantity) as total_dbu, SUM(u.usage_quantity * p.pricing.default) as total_cost FROM system.billing.usage u LEFT JOIN prices p ON u.sku_name = p.sku_name AND u.usage_unit = p.usage_unit AND u.usage_date >= p.start_date AND u.usage_date < p.end_date WHERE u.usage_date >= CURRENT_DATE - INTERVAL 30 DAYS GROUP BY 1 HAVING SUM(u.usage_quantity) != 0 ORDER BY total_cost DESC"
    }
  ],
  "pages": [
    {
      "name": "c9d0e1f2",
      "displayName": "Cost Analysis",
      "layout": [
        {
          "widget": {
            "name": "header",
            "textbox_spec": "# Cost Analysis Dashboard\n\nDatabricks usage and billing for the last 30 days"
          },
          "position": {"x": 0, "y": 0, "width": 12, "height": 1}
        },
        {
          "widget": {
            "name": "total_cost",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "daily_costs",
                "fields": [{"name": "total", "expression": "SUM(`cost`)"}],
                "disaggregated": false
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "counter",
              "encodings": {
                "value": {"fieldName": "total", "displayName": "Total Cost ($)"}
              },
              "frame": {"title": "Total Cost (30 Days)", "showTitle": true}
            }
          },
          "position": {"x": 0, "y": 1, "width": 4, "height": 2}
        },
        {
          "widget": {
            "name": "total_dbu",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "daily_costs",
                "fields": [{"name": "total", "expression": "SUM(`dbu`)"}],
                "disaggregated": false
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "counter",
              "encodings": {
                "value": {"fieldName": "total", "displayName": "Total DBU"}
              },
              "frame": {"title": "Total DBU Consumed", "showTitle": true}
            }
          },
          "position": {"x": 4, "y": 1, "width": 4, "height": 2}
        },
        {
          "widget": {
            "name": "cost_trend",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "daily_costs",
                "fields": [
                  {"name": "date", "expression": "`usage_date`"},
                  {"name": "cost", "expression": "SUM(`cost`)"}
                ],
                "disaggregated": false
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "area",
              "encodings": {
                "x": {"fieldName": "date", "scale": {"type": "temporal"}, "displayName": "Date"},
                "y": {"fieldName": "cost", "scale": {"type": "quantitative"}, "displayName": "Daily Cost ($)"}
              },
              "frame": {"title": "Daily Cost Trend", "showTitle": true}
            }
          },
          "position": {"x": 0, "y": 3, "width": 8, "height": 4}
        },
        {
          "widget": {
            "name": "cost_by_sku",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "sku_summary",
                "fields": [
                  {"name": "sku", "expression": "`sku_name`"},
                  {"name": "cost", "expression": "`total_cost`"}
                ],
                "disaggregated": true
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "pie",
              "encodings": {
                "label": {"fieldName": "sku", "displayName": "SKU"},
                "value": {"fieldName": "cost", "displayName": "Cost"}
              },
              "frame": {"title": "Cost by SKU", "showTitle": true}
            }
          },
          "position": {"x": 8, "y": 3, "width": 4, "height": 4}
        },
        {
          "widget": {
            "name": "sku_table",
            "queries": [{
              "name": "main",
              "query": {
                "datasetName": "sku_summary",
                "fields": [
                  {"name": "sku", "expression": "`sku_name`"},
                  {"name": "dbu", "expression": "`total_dbu`"},
                  {"name": "cost", "expression": "`total_cost`"}
                ],
                "disaggregated": true
              }
            }],
            "spec": {
              "version": 3,
              "widgetType": "table",
              "encodings": {
                "columns": [
                  {"fieldName": "sku", "displayName": "SKU Name"},
                  {"fieldName": "dbu", "displayName": "Total DBU"},
                  {"fieldName": "cost", "displayName": "Total Cost ($)"}
                ]
              },
              "frame": {"title": "Cost Breakdown by SKU", "showTitle": true}
            }
          },
          "position": {"x": 0, "y": 7, "width": 12, "height": 4}
        }
      ]
    }
  ]
}
```

---

## Layout Guidelines

### Grid System

- 12 columns wide
- Position widgets using `x` (0-11), `y` (row), `width` (1-12), `height`
- Avoid overlapping widgets
- Suggested widths: 3 (1/4), 4 (1/3), 6 (1/2), 12 (full)

### Recommended Layout Pattern

```
Row 0: Header/Title (width: 12, height: 1)
Row 1: Filters (3-4 columns each, height: 1)
Row 2-3: Counters/KPIs (3-4 columns each, height: 2)
Row 4-7: Charts (6 columns each, height: 4)
Row 8+: Tables (12 columns, height: 4-6)
```
