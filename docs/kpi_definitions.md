# KPI Definitions

This document defines the KPIs used in the Energy Intelligence System dashboard and their calculation logic.

---

## 1. Projected Production Estimate

**Definition:** The forecasted production volume for a selected region and projection year.

**Calculation Logic:**
- Uses linear trend forecasting (Ordinary Least Squares regression on historical data)
- Fits a line to all available historical production data: `y = mx + b`
- Extrapolates forward to the selected projection year
- If actual data exists for the projection year, uses actual value instead of forecast

**Formula:**
```
Projected Production = m × (year - base_year) + b
where:
  m = slope from OLS regression on historical data
  b = intercept from OLS regression
  base_year = first year in historical data
```

**Units:** Thousand barrels per month (K bbl/mo)

**Data Source:** EIA API v2 (series: PET.MCRFP*.M)

**Displayed As:** Primary metric card showing absolute value with year-over-year change percentage

---

## 2. Year-over-Year (YoY) Change

**Definition:** The percentage change in production between the selected projection year and the previous year.

**Calculation Logic:**
- Compares projected/actual value for year N with year N-1
- Uses combined series (actual data where available, forecast otherwise)
- Displayed as delta on the Projected Production metric card

**Formula:**
```
YoY Change (%) = ((Value_year - Value_year-1) / Value_year-1) × 100
```

**Example:** If 2026 projection is 120K bbl/mo and 2025 was 100K bbl/mo:
```
YoY Change = ((120 - 100) / 100) × 100 = +20%
```

**Displayed As:** Green (positive) or red (negative) delta below projected production value

---

## 3. Latest Production

**Definition:** The most recent actual production value from EIA data (not forecasted).

**Calculation Logic:**
- Fetches monthly production data from EIA API
- Aggregates to annual average: `sum(monthly values) / 12`
- Takes the last available year with complete data

**Formula:**
```
Latest Production = Average monthly production for most recent complete year
```

**Units:** Thousand barrels per month (K bbl/mo)

**Displayed As:** Metric card in the regional quick stats section (top of dashboard)

---

## 4. YoY Change (Current)

**Definition:** Year-over-year change in actual production between the two most recent years of historical data.

**Calculation Logic:**
- Compares last two years of actual EIA data
- Used to show current trend direction (growing/declining/stable)

**Formula:**
```
Current YoY Change (%) = ((Latest_year - Previous_year) / Previous_year) × 100
```

**Displayed As:** Metric card in regional quick stats, also encoded in map visualization

---

## 5. Trend

**Definition:** Qualitative assessment of production trajectory based on recent historical data.

**Calculation Logic:**
- Analyzes YoY change from last two years of data
- Classification:
  - **Growing:** YoY change > +2%
  - **Declining:** YoY change < -2%
  - **Stable:** YoY change between -2% and +2%

**Displayed As:** 
- Text label in regional quick stats
- Color encoding on interactive map (green = growing, red = declining, yellow = stable)

---

## 6. Estimated Revenue

**Definition:** Simple revenue proxy calculated as projected production multiplied by user-specified price assumption.

**Calculation Logic:**
- Takes projected production volume for selected year
- Multiplies by price per unit (user input, default $50/barrel)
- Assumes all production is sold at the specified price

**Formula:**
```
Estimated Revenue = Projected Production × Price per Unit
```

**Example:** If projected production is 120K bbl/mo and price is $50/bbl:
```
Annual Revenue = 120,000 bbl/mo × 12 months × $50/bbl = $72,000,000
```

**Units:** US Dollars ($)

**Displayed As:** Metric below the recommendation and confidence scores

---

## 7. Recommendation

**Definition:** Business decision guidance on whether to pursue investment in the selected region.

**Calculation Logic:**
Rule-based heuristic considering multiple factors:

1. **"Worth pursuing"** if:
   - YoY change is positive (growing production), OR
   - Projected production ≥ last actual production, OR
   - Estimated revenue ≥ revenue threshold (if set)

2. **"Likely not a priority"** if:
   - Revenue threshold is set AND estimated revenue < threshold

3. **"Consider further analysis"** otherwise (neutral/insufficient data)

**Displayed As:** Text label below projected production KPI

---

## 8. Confidence Score

**Definition:** Numerical confidence level (0-100%) indicating reliability of the projection.

**Calculation Logic:**
Multi-factor heuristic:

**Base confidence:**
- 90% if using actual data for the selected year
- 60% if using forecasted data

**Adjustments:**
- **Bonus:** +5% if projection year ≤ last actual year (no extrapolation)
- **Penalty:** -5% per year of extrapolation beyond last actual data
- **Floor:** Minimum 10% confidence
- **Ceiling:** Maximum 100% confidence

**Example:** Forecasting 2028 when last actual data is 2023:
```
Base confidence = 60% (forecast)
Years gap = 2028 - 2023 = 5 years
Penalty = 5 × 5% = 25%
Final confidence = 60% - 25% = 35%
```

**Displayed As:** Percentage below recommendation

---

## Provenance & Transparency

**All KPIs include:**
- EIA series ID (e.g., PET.MCRFPUS1.M for United States)
- Last actual data year and value
- Clear distinction between actual vs forecasted values
- Data sources displayed in conversational AI responses
- Executive summaries show all input facts used
- Last updated timestamp shown on KPI cards

**Data Freshness:**
- EIA data cached locally in `/data/cache/*.csv`
- Cache can be refreshed on-demand via "Refresh Data" button
- Live refresh attempts to fetch fresh data from EIA API
- Graceful degradation to cached data if API unavailable
- Refresh status displayed with timestamp and data source indicator

---

## Tier 2 Custom KPIs

### 9. Production Growth Rate

**Definition:** Year-over-year percentage change in production for the most recent year.

**Calculation Logic:**
- Compares last two years of actual production data
- Identical to "YoY Change (Current)" but surfaced as standalone KPI

**Formula:**
```
Production Growth Rate (%) = ((Latest_year - Previous_year) / Previous_year) × 100
```

**Units:** Percentage (%)

**Displayed As:** Custom KPI card with color coding (green = positive, red = negative)

---

### 10. Production Decline Rate

**Definition:** Average annual rate of production change over the last 5 years.

**Calculation Logic:**
- Takes last 5 years of historical data
- Calculates compound annual growth rate (CAGR)
- Negative values indicate declining production

**Formula:**
```
Decline Rate (%) = ((Value_latest - Value_5years_ago) / Value_5years_ago / 4) × 100
```

**Units:** Percentage per year (%/year)

**Displayed As:** Custom KPI card showing 5-year average trend

---

### 11. Volatility Score

**Definition:** Coefficient of variation measuring production consistency over time.

**Calculation Logic:**
- Calculates standard deviation of all historical production values
- Divides by mean to get normalized volatility measure
- Higher values indicate more erratic production patterns

**Formula:**
```
Volatility Score (%) = (Standard Deviation / Mean) × 100
```

**Units:** Percentage (%)

**Displayed As:** Custom KPI card

---

### 12. Consistency Score

**Definition:** Inverse of volatility, measuring how reliably a region produces.

**Calculation Logic:**
- Inverse transformation of volatility score
- Bounded between 0-100
- Higher scores indicate more consistent production

**Formula:**
```
Consistency Score = max(0, 100 - Volatility Score)
```

**Units:** Score (0-100)

**Color Coding:**
- Green: > 70 (highly consistent)
- Orange: 40-70 (moderately consistent)
- Red: < 40 (inconsistent)

**Displayed As:** Custom KPI card with color-coded value

---

### 13. Relative Performance Index

**Definition:** How a region's growth rate compares to the US national average.

**Calculation Logic:**
- Calculates region's production growth rate
- Calculates US national production growth rate
- Expresses as ratio (100 = matching national average)

**Formula:**
```
Relative Performance Index = (Region Growth Rate / US Growth Rate) × 100
```

**Interpretation:**
- 100 = performing at national average
- > 100 = outperforming national average
- < 100 = underperforming national average

**Units:** Index (100 = baseline)

**Displayed As:** Custom KPI card with color coding (green if > 100, red if < 100)

---

## Sensitivity Analysis

**Definition:** Interactive matrix showing how projected production and revenue change across different decline rate and price assumptions.

**Calculation Logic:**
- Generates forecasts for 7 decline rate scenarios (-30% to +30%)
- Calculates revenue for 7 price points ($30 to $90/bbl)
- Creates 7×7 matrix (49 scenarios)
- Each cell shows production volume and estimated revenue

**Quality Assessment:**
- **Strong (green):** Revenue > $5M
- **Moderate (yellow):** Revenue $1M-$5M
- **Weak (red):** Revenue < $1M

**Displayed As:** Heat map table with color-coded cells

---

## Well Economics Calculator

**Definition:** Financial model for a single horizontal oil well showing production decline, cash flows, and investment metrics.

**Inputs (Editable):**
- Initial production rate (bbl/month)
- Decline rate (exponential, fraction/year)
- Drilling & completion cost ($)
- Monthly operating expense (OPEX, $)
- Oil price ($/bbl)
- Discount rate (fraction)

**Calculated Outputs:**

### Estimated Ultimate Recovery (EUR)
**Definition:** Total cumulative production over well life (10 years)

**Formula:**
```
Monthly Production(t) = Initial Rate × e^(-decline_rate × t/12)
EUR = Σ Monthly Production over 120 months
```

### Net Present Value (NPV)
**Definition:** Present value of all future cash flows discounted at specified rate

**Formula:**
```
NPV = Σ (Cash Flow_t / (1 + discount_rate/12)^t)
where Cash Flow_t = Revenue_t - OPEX_t - (Drilling Cost if t=0)
```

### Internal Rate of Return (IRR)
**Definition:** Discount rate that makes NPV = 0

**Calculation:** Newton-Raphson iterative solver

### Payback Period
**Definition:** Number of months until cumulative cash flow becomes positive

**Calculation:** First month where cumulative cash flow ≥ 0

**Displayed As:** 
- Input panel with editable parameters
- Output metrics (EUR, NPV, IRR, Payback)
- Cumulative cash flow chart over 10 years

---

## Excel Export

**Definition:** Formula-driven spreadsheet export for downstream analysis.

**Contents:**
- Editable input parameters (price, growth assumptions)
- Historical production data
- Forecast calculations with Excel formulas
- KPI summary with aggregation formulas

**Formula Examples:**
- Revenue: `=B13*$B$7` (production × price)
- Forecast: `=B{row-1}*(1+$B$9)` (compound growth)
- Total: `=SUM(B13:B25)` (aggregation)

**File Format:** CSV (Excel-compatible)

**Use Case:** Allows analysts to modify assumptions and extend analysis in familiar tools
