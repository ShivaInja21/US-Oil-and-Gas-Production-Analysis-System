import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface ForecastPoint {
  year: number;
  actual?: number;
  forecast?: number;
}

interface KPI {
  label: string;
  value: number;
  unit: string;
  pct_change?: number;
  recommendation: string;
  confidence: number;
  estimated_revenue?: number;
}

interface Anomaly {
  year: number;
  severity: string;
  description: string;
  value: number;
  expected_range: string;
  z_score: number;
}

const REGION_TO_SERIES: Record<string, string> = {
  'United States': 'PET.MCRFPUS1.M',
  'Texas': 'PET.MCRFPTX2.M',
  'North Dakota': 'PET.MCRFPND2.M',
  'New Mexico': 'PET.MCRFPNM2.M',
  'Oklahoma': 'PET.MCRFPOK2.M',
  'Colorado': 'PET.MCRFPCO2.M',
};

function linearForecast(values: number[], years: number): number[] {
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = values;
  
  // Calculate linear regression
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Generate forecasts
  const forecasts: number[] = [];
  for (let i = 0; i < years; i++) {
    forecasts.push(slope * (n + i) + intercept);
  }
  
  return forecasts;
}

function detectAnomalies(values: number[], years: number[]): Anomaly[] {
  if (values.length < 3) return [];
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  
  if (std === 0) return [];
  
  const anomalies: Anomaly[] = [];
  const threshold = 2.0;
  
  values.forEach((value, i) => {
    const zScore = Math.abs((value - mean) / std);
    if (zScore > threshold) {
      anomalies.push({
        year: years[i],
        value,
        expected_range: `${(mean - threshold * std).toFixed(0)} - ${(mean + threshold * std).toFixed(0)}`,
        z_score: zScore,
        severity: zScore > 3.0 ? 'High' : 'Medium',
        description: `Production in ${years[i]} deviates ${zScore.toFixed(1)}σ from historical average`
      });
    }
  });
  
  return anomalies.sort((a, b) => b.z_score - a.z_score);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const region = (req.query.region as string) || 'United States';
    const year = parseInt(req.query.year as string) || 2026;
    const yearsAfter = parseInt(req.query.yearsAfter as string) || 5;
    const price = parseFloat(req.query.price as string) || 50;
    
    const seriesId = REGION_TO_SERIES[region] || REGION_TO_SERIES['United States'];
    const cachePath = path.join(process.cwd(), 'api', 'data', 'cache', `${seriesId}.csv`);
    
    if (!fs.existsSync(cachePath)) {
      return res.status(404).json({ error: 'Data not found for region' });
    }

    const csvContent = fs.readFileSync(cachePath, 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });
    
    // Aggregate by year
    const yearlyData: Record<number, number> = {};
    records.forEach((record: any) => {
      const period = record.period;
      const value = parseFloat(record.value);
      
      if (isNaN(value)) return;
      
      const recordYear = parseInt(period.substring(0, 4));
      if (!yearlyData[recordYear]) yearlyData[recordYear] = 0;
      yearlyData[recordYear] += value;
    });
    
    const years = Object.keys(yearlyData).map(Number).sort();
    const values = years.map(y => yearlyData[y]);
    
    // Generate forecast
    const lastActualYear = years[years.length - 1];
    const historicalValues = values;
    
    // Calculate how many years to forecast from last actual year
    const forecastHorizon = (year + yearsAfter - 1) - lastActualYear;
    const forecastValues = forecastHorizon > 0 ? linearForecast(historicalValues, forecastHorizon) : [];
    
    // Build combined data
    const forecastData: ForecastPoint[] = [];
    const startYear = years[0];
    const endYear = year + yearsAfter - 1;
    
    for (let y = startYear; y <= endYear; y++) {
      const point: ForecastPoint = { year: y };
      
      if (yearlyData[y]) {
        point.actual = yearlyData[y];
      }
      
      if (y >= year && y > lastActualYear) {
        const forecastIndex = y - lastActualYear - 1;
        if (forecastIndex >= 0 && forecastIndex < forecastValues.length) {
          point.forecast = forecastValues[forecastIndex];
        }
      }
      
      forecastData.push(point);
    }
    
    // Calculate KPI
    const projectedValue = year > lastActualYear 
      ? forecastValues[year - lastActualYear - 1] 
      : yearlyData[year];
    
    const lastActual = yearlyData[lastActualYear];
    const pctChange = lastActual ? (projectedValue - lastActual) / lastActual : 0;
    
    const kpi: KPI = {
      label: `Projected production (${year})`,
      value: projectedValue || 0,
      unit: 'barrels',
      pct_change: pctChange,
      recommendation: pctChange > 0 ? 'Worth pursuing' : 'Consider further analysis',
      confidence: year > lastActualYear ? Math.max(0.1, 0.6 - 0.05 * (year - lastActualYear)) : 0.9,
      estimated_revenue: projectedValue * price
    };
    
    // Detect anomalies
    const anomalies = detectAnomalies(values, years);
    
    res.status(200).json({
      forecast: forecastData,
      kpi,
      anomalies
    });
  } catch (error: any) {
    console.error('Forecast API error:', error);
    res.status(500).json({ error: error.message });
  }
}
