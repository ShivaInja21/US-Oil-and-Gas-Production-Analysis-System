# Architecture Overview

## Final Tech Stack

**Frontend:**
- Next.js 14 (React framework)
- TypeScript
- Recharts (data visualization)
- Leaflet.js + React-Leaflet (interactive maps)

**Backend:**
- Python 3.10+ (serverless functions)
- Pandas (data manipulation)
- NumPy (numerical computations)
- OpenAI API (conversational AI and summaries)

**Deployment:**
- Vercel (hosting and serverless functions)
- Next.js API routes proxying to Python serverless functions

**Data Source:**
- EIA (U.S. Energy Information Administration) API v2

## Folder Structure

```
├── pages/
│   ├── index.tsx           # Main dashboard UI (React/Next.js)
│   └── api/                # Next.js API routes (TypeScript wrappers)
│       ├── forecast.ts     # Proxies to Python forecast endpoint
│       ├── regions.ts      # Proxies to Python regions endpoint
│       ├── ask.ts          # Proxies to Python conversational AI
│       ├── summary.ts      # Proxies to Python summary generator
│       ├── custom-kpis.ts  # Custom KPI calculations 
│       ├── sensitivity.ts  # Sensitivity analysis matrix 
│       ├── well-economics.ts # Well economics calculator 
│       ├── export-excel.ts # Excel export with formulas 
│       └── refresh.ts      # Live data refresh endpoint 
├── api/                    # Python serverless functions (Vercel)
│   ├── forecast.py         # Forecast computation endpoint
│   ├── regions.py          # All regions data endpoint
│   ├── ask.py              # Conversational AI endpoint
│   └── src/                # Shared Python modules
│       ├── eia_client.py   # EIA API client with caching
│       ├── data_prep.py    # Data transformation utilities
│       ├── forecast.py     # Linear trend forecasting logic
│       ├── kpis.py         # KPI calculation functions
│       ├── ai_summary.py   # OpenAI integration for AI features
│       └── map_viz.py      # Geographic data processing
├── src/                    # Duplicate Python modules (for local dev)
├── components/
│   └── MapComponent.tsx    # Interactive Leaflet map component
├── data/cache/             # Cached EIA API responses (CSV)
└── styles/
    └── globals.css         # Global styles
```

## Cross-Tab Data Flow

**Example 1: Map → Dashboard Region Selection**
- User clicks a state on the interactive map (MapComponent.tsx)
- Click handler calls `onRegionSelect(regionName)` prop callback
- Parent component (index.tsx) updates `selectedRegion` state via `setSelectedRegion`
- State change triggers `useEffect` hook that calls `/api/forecast` with new region
- Forecast data, KPIs, and anomalies update automatically
- Region dropdown selector syncs to match map selection

**Example 2: Dashboard Controls → All Visualizations**
- User adjusts sliders (projection year, years after pivot, price assumption)
- React state updates (`year`, `yearsAfter`, `price`) trigger `useEffect` dependency
- Single API call to `/api/forecast?region=X&year=Y&yearsAfter=Z&price=P`
- Python serverless function computes forecast using `forecast_with_pivot()`
- Returns combined historical + forecast data, KPI metrics, and anomalies
- Frontend updates: line chart, KPI cards, anomaly list, and AI context simultaneously

**Example 3: KPI Data → Conversational AI Context**
- When user asks a question, frontend bundles current KPI data into context object
- Context includes: region, series_id, last_actual_year/value, projection_year/value, recommendation, confidence, revenue
- POST request to `/api/ask` with question + context
- Python function passes context to OpenAI with system prompt enforcing data citation
- Response includes answer, data sources used, and inference flag
- Frontend displays answer with provenance badges (verified data vs AI inference)

## AI Integration Design

The system implements three AI-powered features that add genuine analytical value:

### 1. Conversational Interface
- **What it does:** Allows analysts to ask natural language questions about regional production data and forecasts
- **Context management:** Passes live data context including:
  - Current region and EIA series ID
  - Historical data (last actual year/value)
  - Forecast projections and KPIs
  - Recommendation and confidence scores
  - Revenue estimates and price assumptions
- **Boundary handling:** 
  - System prompt explicitly instructs model to cite specific numbers from data
  - Responses flagged as "inference" vs "data-backed" based on language patterns
  - Data sources displayed with each answer for traceability
  - Visual indicators distinguish verified data from AI-generated insights

### 2. Anomaly Detection
- **What it does:** Flags unusual production patterns using statistical analysis
- **Method:** Z-score based detection (configurable threshold, default 2.0σ)
- **Output:** Year, actual value, expected range, severity (Medium/High), and description
- **Value:** Helps analysts quickly identify years requiring deeper investigation

### 3. Executive Summaries
- **What it does:** Auto-generates investment summaries based on current KPIs
- **Provenance:** All facts passed to model are displayed alongside summary
- **Prompt engineering:** 
  - Temperature set to 0.1-0.2 for consistency
  - Explicit instruction to label inference clearly
  - Structured fact injection prevents hallucination
  - Max tokens limited to keep responses concise

### Key Design Decisions
- **Live data access:** AI features receive real-time data from EIA API, not static training data
- **Transparency:** Every AI output includes provenance/data sources
- **Graceful degradation:** System works without OPENAI_API_KEY (shows helpful messages)
- **Minimal token usage:** Concise prompts and low max_tokens keep API costs reasonable


### Custom KPIs
**Endpoint:** `/api/custom-kpis.ts`

**Calculation Flow:**
1. Fetches cached EIA data for selected region
2. Aggregates monthly data to annual totals
3. Computes 5 additional metrics:
   - Production Growth Rate (YoY %)
   - Decline Rate (5-year average)
   - Volatility Score (coefficient of variation)
   - Consistency Score (inverse volatility)
   - Relative Performance Index (vs US average)
4. Returns JSON with all metrics

**Integration:** Fetched automatically when region changes, displayed in grid layout

### Sensitivity Analysis
**Endpoint:** `/api/sensitivity.ts`

**Calculation Flow:**
1. Defines parameter ranges:
   - Decline rates: -30% to +30% (7 values)
   - Prices: $30 to $90/bbl (7 values)
2. For each combination (49 scenarios):
   - Adjusts forecast slope by decline rate
   - Calculates production for target year
   - Computes revenue = production × price
   - Assigns quality rating (weak/moderate/strong)
3. Returns 7×7 matrix with all scenarios

**Integration:** On-demand via button click, displays as color-coded heat map table

### Well Economics Calculator
**Endpoint:** `/api/well-economics.ts`

**Calculation Flow:**
1. Accepts editable inputs (initial rate, decline, costs, price, discount rate)
2. Generates 120-month production profile using exponential decline:
   ```
   Production(t) = Initial Rate × e^(-decline_rate × t/12)
   ```
3. Calculates monthly cash flows:
   ```
   CF(0) = Revenue(0) - OPEX - Drilling Cost
   CF(t) = Revenue(t) - OPEX  (for t > 0)
   ```
4. Computes financial metrics:
   - EUR: Sum of all production
   - NPV: Discounted cash flows
   - IRR: Newton-Raphson solver
   - Payback: First month with positive cumulative CF
5. Returns time series + summary metrics

**Integration:** Toggle panel with input form, real-time calculation, cumulative cash flow chart

### Excel Export
**Endpoint:** `/api/export-excel.ts`

**Export Structure:**
1. **Header:** Region, export date, data source
2. **Editable Inputs:** Price, forecast year, growth rate (cell references)
3. **Historical Data:** Year, production, YoY%, revenue formula
4. **Forecast Calculations:** Excel formulas referencing input cells
5. **KPI Summary:** Aggregation formulas (SUM, AVERAGE)

**Formula Examples:**
- Revenue: `=B13*$B$7` (production × price cell)
- Forecast: `=B{row-1}*(1+$B$9)` (compound growth)
- Total: `=SUM(B13:B25)` (range aggregation)

**Integration:** Button triggers download, opens in new tab

### Live Data Refresh
**Endpoint:** `/api/refresh.ts`

**Refresh Flow:**
1. Checks cache file timestamp
2. If `force=true` and EIA_API_KEY available:
   - Fetches fresh data from EIA API v2
   - Converts JSON response to CSV format
   - Overwrites cache file
   - Updates timestamp
3. If API unavailable or not forced:
   - Returns cache metadata
   - Displays last updated timestamp
4. Returns status: 'live', 'cache', or 'cache-fallback'

**Error Handling:**
- API timeout: 10 seconds
- Graceful degradation to cached data
- Clear status messages for each scenario

**Integration:** 
- Automatic status check on load
- Manual refresh button
- Status indicator with timestamp
- Color-coded messages (green=live, yellow=cache)