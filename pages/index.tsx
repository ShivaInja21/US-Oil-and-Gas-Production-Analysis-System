import { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface KPIData {
  label: string;
  value: number;
  unit: string;
  pct_change?: number;
  recommendation: string;
  confidence: number;
  estimated_revenue?: number;
}

interface ForecastDataPoint {
  year: number;
  actual?: number;
  forecast?: number;
}

interface Anomaly {
  year: number;
  severity: string;
  description: string;
  value: number;
  expected_range: string;
  z_score: number;
}

interface RegionData {
  production: number;
  yoy_change: number;
  trend: string;
}

interface AnswerData {
  answer: string;
  data_sources?: string[];
  is_inference: boolean;
}

interface SummaryData {
  text: string;
  provenance: Record<string, any>;
}

interface CustomKPIs {
  production_growth_rate: number;
  decline_rate: number;
  volatility_score: number;
  relative_performance_index: number;
  consistency_score: number;
}

interface SensitivityCell {
  declineRate: number;
  price: number;
  production: number;
  revenue: number;
  quality: 'weak' | 'moderate' | 'strong';
}

interface SensitivityData {
  region: string;
  year: number;
  declineRates: number[];
  prices: number[];
  matrix: SensitivityCell[][];
}

interface WellEconomics {
  monthly_production: number[];
  cumulative_production: number[];
  monthly_revenue: number[];
  monthly_cash_flow: number[];
  cumulative_cash_flow: number[];
  eur: number;
  npv: number;
  irr: number;
  payback_months: number | null;
}

interface RefreshStatus {
  lastUpdated: string;
  dataSource: string;
  message: string;
}

const MapComponent = dynamic(() => import('../components/MapComponent'), { ssr: false });

const REGION_TO_SERIES = {
  "United States": "PET.MCRFPUS1.M",
  "Alabama": "PET.MCRFPAL2.M",
  "Alaska": "PET.MCRFPAK2.M",
  "Arkansas": "PET.MCRFPAR2.M",
  "California": "PET.MCRFPCA2.M",
  "Colorado": "PET.MCRFPCO2.M",
  "Florida": "PET.MCRFPFL2.M",
  "Illinois": "PET.MCRFPIL2.M",
  "Indiana": "PET.MCRFPIN2.M",
  "Kansas": "PET.MCRFPKS2.M",
  "Kentucky": "PET.MCRFPKY2.M",
  "Louisiana": "PET.MCRFPLA2.M",
  "Michigan": "PET.MCRFPMI2.M",
  "Mississippi": "PET.MCRFPMS2.M",
  "Montana": "PET.MCRFPMT2.M",
  "Nebraska": "PET.MCRFPNE2.M",
  "New Mexico": "PET.MCRFPNM2.M",
  "North Dakota": "PET.MCRFPND2.M",
  "Ohio": "PET.MCRFPOH2.M",
  "Oklahoma": "PET.MCRFPOK2.M",
  "Pennsylvania": "PET.MCRFPPA2.M",
  "Texas": "PET.MCRFPTX2.M",
  "Utah": "PET.MCRFPUT2.M",
  "West Virginia": "PET.MCRFPWV2.M",
  "Wyoming": "PET.MCRFPWY2.M",
  "Federal Offshore Gulf of Mexico": "PET.MCRFP3FM2.M",
};

export default function Home() {
  const [selectedRegion, setSelectedRegion] = useState('United States');
  const [year, setYear] = useState(2026);
  const [yearsAfter, setYearsAfter] = useState(5);
  const [price, setPrice] = useState(50);
  const [forecastData, setForecastData] = useState<ForecastDataPoint[] | null>(null);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [regionsData, setRegionsData] = useState<Record<string, RegionData>>({});
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AnswerData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [customKPIs, setCustomKPIs] = useState<CustomKPIs | null>(null);
  const [sensitivityData, setSensitivityData] = useState<SensitivityData | null>(null);
  const [wellEconomics, setWellEconomics] = useState<WellEconomics | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus | null>(null);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showWellCalc, setShowWellCalc] = useState(false);
  const [wellInputs, setWellInputs] = useState({
    initialRate: 1000,
    declineRate: 0.3,
    drillingCost: 5000000,
    opex: 50000,
    oilPrice: 70,
    discountRate: 0.1
  });

  useEffect(() => {
    fetchAllRegionsData();
  }, []);

  useEffect(() => {
    if (selectedRegion) {
      fetchRegionData();
      fetchCustomKPIs();
    }
  }, [selectedRegion, year, yearsAfter, price]);

  const fetchAllRegionsData = async () => {
    try {
      const res = await fetch('/api/regions');
      const data = await res.json();
      setRegionsData(data);
    } catch (err) {
      console.error('Failed to fetch regions data:', err);
    }
  };

  const fetchRegionData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forecast?region=${selectedRegion}&year=${year}&yearsAfter=${yearsAfter}&price=${price}`);
      const data = await res.json();
      setForecastData(data.forecast);
      setKpiData(data.kpi);
      setAnomalies(data.anomalies || []);
    } catch (err) {
      console.error('Failed to fetch forecast:', err);
    }
    setLoading(false);
  };

  const fetchCustomKPIs = async () => {
    try {
      const res = await fetch(`/api/custom-kpis?region=${selectedRegion}`);
      const data = await res.json();
      setCustomKPIs(data);
    } catch (err) {
      console.error('Failed to fetch custom KPIs:', err);
    }
  };

  const fetchSensitivityAnalysis = async () => {
    try {
      const res = await fetch(`/api/sensitivity?region=${selectedRegion}&year=${year}`);
      const data = await res.json();
      setSensitivityData(data);
      setShowSensitivity(true);
    } catch (err) {
      console.error('Failed to fetch sensitivity:', err);
    }
  };

  const calculateWellEconomics = async () => {
    try {
      const res = await fetch('/api/well-economics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...wellInputs, months: 120 })
      });
      const data = await res.json();
      setWellEconomics(data);
    } catch (err) {
      console.error('Failed to calculate well economics:', err);
    }
  };

  const refreshData = async (force: boolean = false) => {
    try {
      const res = await fetch(`/api/refresh?region=${selectedRegion}&force=${force}`);
      const data = await res.json();
      setRefreshStatus(data);
      if (force) {
        await fetchRegionData();
        await fetchCustomKPIs();
      }
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  };

  const exportToExcel = () => {
    window.open(`/api/export-excel?region=${selectedRegion}&year=${year}&price=${price}`, '_blank');
  };

  const handleAskQuestion = async () => {
    if (!question) return;
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, region: selectedRegion, kpi: kpiData })
      });
      const data = await res.json();
      setAnswer(data);
    } catch (err) {
      console.error('Failed to ask question:', err);
    }
  };

  const handleGenerateSummary = async () => {
    if (!kpiData) return;
    setSummaryLoading(true);
    try {
      const facts = {
        'Region': selectedRegion,
        'Projection Year': year,
        'Projected Production': `${kpiData.value?.toLocaleString()} ${kpiData.unit}`,
        'Change from Current': kpiData.pct_change !== undefined ? `${(kpiData.pct_change * 100).toFixed(2)}%` : 'N/A',
        'Estimated Revenue': kpiData.estimated_revenue ? `$${kpiData.estimated_revenue.toLocaleString()}` : 'N/A',
        'Confidence': `${(kpiData.confidence * 100).toFixed(0)}%`,
        'Current Production': regionsData[selectedRegion] ? `${regionsData[selectedRegion].production.toLocaleString()}K bbl/mo` : 'N/A',
        'YoY Change': regionsData[selectedRegion] ? `${regionsData[selectedRegion].yoy_change.toFixed(1)}%` : 'N/A',
        'Trend': regionsData[selectedRegion]?.trend || 'N/A'
      };
      
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: selectedRegion, facts })
      });
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error('Failed to generate summary:', err);
    }
    setSummaryLoading(false);
  };

  return (
    <>
      <Head>
        <title>Energy Intelligence System</title>
        <meta name="description" content="AI-powered energy production forecasting" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </Head>

      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        <h1>Energy Intelligence System</h1>

        <section style={{ marginBottom: '40px' }}>
          <h2>🗺️ Geographic Production Overview</h2>
          <p style={{ color: '#666' }}>Interactive map showing regional oil production data. Click any region to update the dashboard below.</p>
          <MapComponent 
            regionsData={regionsData} 
            selectedRegion={selectedRegion}
            onRegionSelect={setSelectedRegion}
          />
        </section>

        <hr />

        <section>
          <h2>📊 Regional Analysis & Forecasting</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label>Region</label>
              <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                {Object.keys(REGION_TO_SERIES).map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              <label style={{ marginTop: '15px', display: 'block' }}>Projection year: {year}</label>
              <input type="range" min="2023" max="2035" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: '100%' }} />

              <label style={{ marginTop: '15px', display: 'block' }}>Years after pivot: {yearsAfter}</label>
              <input type="range" min="1" max="10" value={yearsAfter} onChange={(e) => setYearsAfter(Number(e.target.value))} style={{ width: '100%' }} />

              <label style={{ marginTop: '15px', display: 'block' }}>Price (USD/unit)</label>
              <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ width: '100%', padding: '8px' }} />
            </div>

            <div>
              <h3>Selected region: {selectedRegion}</h3>
              {regionsData[selectedRegion] && (
                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                  <div style={{ padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>Latest Production</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{regionsData[selectedRegion].production.toLocaleString()}K bbl/mo</div>
                  </div>
                  <div style={{ padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>YoY Change</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{regionsData[selectedRegion].yoy_change.toFixed(1)}%</div>
                  </div>
                  <div style={{ padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>Trend</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{regionsData[selectedRegion].trend}</div>
                  </div>
                </div>
              )}

              {loading && <p>Loading forecast...</p>}
              
              {forecastData && (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="actual" stroke="#8884d8" strokeWidth={2} />
                      <Line type="monotone" dataKey="forecast" stroke="#82ca9d" strokeWidth={2} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>

                  {kpiData && (
                    <div style={{ marginTop: '30px' }}>
                      <h3>📈 Core KPI: Projected Production Estimate</h3>
                      <div style={{ padding: '20px', background: '#f0f8ff', borderRadius: '8px', marginBottom: '20px' }}>
                        <div style={{ fontSize: '14px', color: '#666' }}>{kpiData.label}</div>
                        <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                          {kpiData.value?.toLocaleString()} {kpiData.unit}
                          {kpiData.pct_change !== undefined && kpiData.pct_change !== 0 && (
                            <span style={{ fontSize: '18px', color: kpiData.pct_change > 0 ? 'green' : 'red', marginLeft: '10px' }}>
                              {kpiData.pct_change > 0 ? '+' : ''}{(kpiData.pct_change * 100).toFixed(2)}%
                            </span>
                          )}
                        </div>
                        <div style={{ marginTop: '15px' }}>
                          <strong>Recommendation:</strong> {kpiData.recommendation}<br />
                          <strong>Confidence:</strong> {(kpiData.confidence * 100).toFixed(0)}%
                        </div>
                        {kpiData.estimated_revenue && (
                          <div style={{ marginTop: '10px', fontSize: '18px' }}>
                            <strong>Estimated revenue:</strong> ${kpiData.estimated_revenue.toLocaleString()}
                          </div>
                        )}
                        <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
                          📋 Data Source: EIA API | Last Updated: {refreshStatus?.lastUpdated ? new Date(refreshStatus.lastUpdated).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>

                      <h3>📊 Custom KPIs</h3>
                      {customKPIs && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                          <div style={{ padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#666' }}>Production Growth Rate</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: customKPIs.production_growth_rate > 0 ? 'green' : 'red' }}>
                              {customKPIs.production_growth_rate > 0 ? '+' : ''}{customKPIs.production_growth_rate.toFixed(2)}%
                            </div>
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>Year-over-year change</div>
                          </div>
                          <div style={{ padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#666' }}>Decline Rate (5yr avg)</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                              {customKPIs.decline_rate.toFixed(2)}%
                            </div>
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>Annual production change</div>
                          </div>
                          <div style={{ padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#666' }}>Consistency Score</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: customKPIs.consistency_score > 70 ? 'green' : customKPIs.consistency_score > 40 ? 'orange' : 'red' }}>
                              {customKPIs.consistency_score.toFixed(0)}/100
                            </div>
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>Production reliability</div>
                          </div>
                          <div style={{ padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#666' }}>Volatility Score</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                              {customKPIs.volatility_score.toFixed(2)}%
                            </div>
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>Coefficient of variation</div>
                          </div>
                          <div style={{ padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#666' }}>Relative Performance</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: customKPIs.relative_performance_index > 100 ? 'green' : 'red' }}>
                              {customKPIs.relative_performance_index.toFixed(0)}
                            </div>
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>vs US average (100 = baseline)</div>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <button onClick={exportToExcel} style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                          📥 Export to Excel
                        </button>
                        <button onClick={fetchSensitivityAnalysis} style={{ padding: '10px 20px', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                          🔍 Sensitivity Analysis
                        </button>
                        <button onClick={() => setShowWellCalc(!showWellCalc)} style={{ padding: '10px 20px', background: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                          💰 Well Economics Calculator
                        </button>
                        <button onClick={() => refreshData(true)} style={{ padding: '10px 20px', background: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                          🔄 Refresh Data
                        </button>
                      </div>

                      {refreshStatus && (
                        <div style={{ padding: '10px', background: refreshStatus.dataSource === 'live' ? '#d4edda' : '#fff3cd', borderRadius: '4px', marginBottom: '20px', fontSize: '14px' }}>
                          {refreshStatus.message}
                        </div>
                      )}

                      {showSensitivity && sensitivityData && (
                        <div style={{ marginBottom: '30px' }}>
                          <h3>🔍 Sensitivity Analysis Matrix</h3>
                          <p style={{ color: '#666', fontSize: '14px' }}>How projected production changes across decline rate and price assumptions for {year}</p>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                              <thead>
                                <tr>
                                  <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>Decline Rate \ Price</th>
                                  {sensitivityData.prices.map(p => (
                                    <th key={p} style={{ border: '1px solid #ddd', padding: '8px', background: '#f8f9fa' }}>${p}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sensitivityData.matrix.map((row, i) => (
                                  <tr key={i}>
                                    <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>
                                      {(sensitivityData.declineRates[i] * 100).toFixed(0)}%
                                    </td>
                                    {row.map((cell, j) => {
                                      const bgColor = cell.quality === 'strong' ? '#d4edda' : cell.quality === 'moderate' ? '#fff3cd' : '#f8d7da';
                                      return (
                                        <td key={j} style={{ border: '1px solid #ddd', padding: '8px', background: bgColor, textAlign: 'center' }}>
                                          <div style={{ fontWeight: 'bold' }}>{cell.production.toLocaleString()}</div>
                                          <div style={{ fontSize: '10px', color: '#666' }}>${(cell.revenue / 1000000).toFixed(1)}M</div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                            <span style={{ background: '#d4edda', padding: '2px 8px', marginRight: '10px' }}>Strong (&gt;$5M)</span>
                            <span style={{ background: '#fff3cd', padding: '2px 8px', marginRight: '10px' }}>Moderate ($1M-$5M)</span>
                            <span style={{ background: '#f8d7da', padding: '2px 8px' }}>Weak (&lt;$1M)</span>
                          </div>
                        </div>
                      )}

                      {showWellCalc && (
                        <div style={{ marginBottom: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                          <h3>💰 Well Economics Calculator</h3>
                          <p style={{ color: '#666', fontSize: '14px' }}>Interactive financial model for a horizontal oil well</p>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                            <div>
                              <label style={{ fontSize: '12px', color: '#666' }}>Initial Production Rate (bbl/mo)</label>
                              <input type="number" value={wellInputs.initialRate} onChange={(e) => setWellInputs({...wellInputs, initialRate: Number(e.target.value)})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', color: '#666' }}>Decline Rate (fraction/year)</label>
                              <input type="number" step="0.01" value={wellInputs.declineRate} onChange={(e) => setWellInputs({...wellInputs, declineRate: Number(e.target.value)})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', color: '#666' }}>Drilling & Completion Cost ($)</label>
                              <input type="number" value={wellInputs.drillingCost} onChange={(e) => setWellInputs({...wellInputs, drillingCost: Number(e.target.value)})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', color: '#666' }}>Monthly OPEX ($)</label>
                              <input type="number" value={wellInputs.opex} onChange={(e) => setWellInputs({...wellInputs, opex: Number(e.target.value)})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', color: '#666' }}>Oil Price ($/bbl)</label>
                              <input type="number" value={wellInputs.oilPrice} onChange={(e) => setWellInputs({...wellInputs, oilPrice: Number(e.target.value)})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', color: '#666' }}>Discount Rate (fraction)</label>
                              <input type="number" step="0.01" value={wellInputs.discountRate} onChange={(e) => setWellInputs({...wellInputs, discountRate: Number(e.target.value)})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                            </div>
                          </div>

                          <button onClick={calculateWellEconomics} style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px' }}>
                            Calculate Economics
                          </button>

                          {wellEconomics && (
                            <>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                                <div style={{ padding: '15px', background: 'white', borderRadius: '8px' }}>
                                  <div style={{ fontSize: '12px', color: '#666' }}>EUR (10 years)</div>
                                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{wellEconomics.eur.toLocaleString()} bbl</div>
                                </div>
                                <div style={{ padding: '15px', background: 'white', borderRadius: '8px' }}>
                                  <div style={{ fontSize: '12px', color: '#666' }}>NPV @ 10%</div>
                                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: wellEconomics.npv > 0 ? 'green' : 'red' }}>
                                    ${(wellEconomics.npv / 1000000).toFixed(2)}M
                                  </div>
                                </div>
                                <div style={{ padding: '15px', background: 'white', borderRadius: '8px' }}>
                                  <div style={{ fontSize: '12px', color: '#666' }}>IRR</div>
                                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{wellEconomics.irr.toFixed(1)}%</div>
                                </div>
                                <div style={{ padding: '15px', background: 'white', borderRadius: '8px' }}>
                                  <div style={{ fontSize: '12px', color: '#666' }}>Payback Period</div>
                                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                                    {wellEconomics.payback_months ? `${wellEconomics.payback_months} mo` : 'N/A'}
                                  </div>
                                </div>
                              </div>

                              <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={wellEconomics.cumulative_cash_flow.map((cf, i) => ({ month: i, cashFlow: cf / 1000000 }))}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="month" label={{ value: 'Month', position: 'insideBottom', offset: -5 }} />
                                  <YAxis label={{ value: 'Cumulative Cash Flow ($M)', angle: -90, position: 'insideLeft' }} />
                                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}M`} />
                                  <Legend />
                                  <Line type="monotone" dataKey="cashFlow" stroke="#8884d8" strokeWidth={2} name="Cumulative Cash Flow" />
                                </LineChart>
                              </ResponsiveContainer>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <h3>🔍 AI-Powered Anomaly Detection</h3>
                  {anomalies.length > 0 ? (
                    <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                      <p>⚠️ Detected {anomalies.length} unusual production pattern(s)</p>
                      {anomalies.map((anom, i) => (
                        <details key={i} style={{ marginTop: '10px' }}>
                          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                            {anom.severity} anomaly in {anom.year}
                          </summary>
                          <div style={{ marginTop: '10px', paddingLeft: '20px' }}>
                            <p>{anom.description}</p>
                            <p><strong>Actual value:</strong> {anom.value.toLocaleString()}</p>
                            <p><strong>Expected range:</strong> {anom.expected_range}</p>
                            <p><strong>Statistical deviation:</strong> {anom.z_score.toFixed(2)}σ</p>
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : (
                    <div style={{ background: '#d4edda', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                      ✓ No significant anomalies detected in historical data
                    </div>
                  )}

                  <h3>💬 Ask Questions About This Region</h3>
                  <p style={{ color: '#666', fontSize: '14px' }}>AI-powered conversational interface with access to live data</p>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <input 
                      type="text" 
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="e.g., What is the production trend for this region?"
                      style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <button onClick={handleAskQuestion} style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      📊 Ask Question
                    </button>
                  </div>
                  {answer && (
                    <div style={{ background: '#e7f3ff', padding: '15px', borderRadius: '8px', marginTop: '10px' }}>
                      <strong>Answer:</strong>
                      <p>{answer.answer}</p>
                      {answer.data_sources && answer.data_sources.length > 0 && (
                        <>
                          <strong>Data sources:</strong>
                          <ul>
                            {answer.data_sources.map((src, i) => <li key={i}>{src}</li>)}
                          </ul>
                        </>
                      )}
                      {answer.is_inference ? (
                        <div style={{ background: '#fff3cd', padding: '10px', borderRadius: '4px', marginTop: '10px' }}>
                          ⚠️ This answer contains AI-generated inference beyond raw data
                        </div>
                      ) : (
                        <div style={{ background: '#d4edda', padding: '10px', borderRadius: '4px', marginTop: '10px' }}>
                          ✓ This answer is grounded in verified data
                        </div>
                      )}
                    </div>
                  )}

                  <h3 style={{ marginTop: '30px' }}>📊 Executive Summary</h3>
                  <p style={{ color: '#666', fontSize: '14px' }}>Auto-generated investment summary based on current KPIs with full provenance tracking</p>
                  <button 
                    onClick={handleGenerateSummary} 
                    disabled={summaryLoading}
                    style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '10px' }}
                  >
                    {summaryLoading ? '⏳ Generating...' : '📝 Generate Executive Summary'}
                  </button>
                  {summary && (
                    <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                      <div style={{ whiteSpace: 'pre-wrap', marginBottom: '15px' }}>{summary.text}</div>
                      <details style={{ marginTop: '15px' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#666' }}>📋 View Data Provenance</summary>
                        <div style={{ marginTop: '10px', paddingLeft: '20px', fontSize: '14px' }}>
                          {Object.entries(summary.provenance).map(([key, value]) => (
                            <div key={key} style={{ marginBottom: '5px' }}>
                              <strong>{key}:</strong> {String(value)}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
