import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface CustomKPIs {
  production_growth_rate: number;
  decline_rate: number;
  volatility_score: number;
  relative_performance_index: number;
  consistency_score: number;
}

const REGION_TO_SERIES: Record<string, string> = {
  'United States': 'PET.MCRFPUS1.M',
  'Texas': 'PET.MCRFPTX2.M',
  'North Dakota': 'PET.MCRFPND2.M',
  'New Mexico': 'PET.MCRFPNM2.M',
  'Oklahoma': 'PET.MCRFPOK2.M',
  'Colorado': 'PET.MCRFPCO2.M',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const region = (req.query.region as string) || 'United States';
    const seriesId = REGION_TO_SERIES[region] || REGION_TO_SERIES['United States'];
    const cachePath = path.join(process.cwd(), 'api', 'data', 'cache', `${seriesId}.csv`);
    
    if (!fs.existsSync(cachePath)) {
      return res.status(404).json({ error: 'Data not found' });
    }

    const csvContent = fs.readFileSync(cachePath, 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });
    
    const yearlyData: Record<number, number> = {};
    records.forEach((record: any) => {
      const value = parseFloat(record.value);
      if (isNaN(value)) return;
      const recordYear = parseInt(record.period.substring(0, 4));
      if (!yearlyData[recordYear]) yearlyData[recordYear] = 0;
      yearlyData[recordYear] += value;
    });
    
    const years = Object.keys(yearlyData).map(Number).sort();
    const values = years.map(y => yearlyData[y]);
    
    // Production Growth Rate (YoY % change)
    const lastYear = years[years.length - 1];
    const prevYear = years[years.length - 2];
    const production_growth_rate = prevYear ? ((yearlyData[lastYear] - yearlyData[prevYear]) / yearlyData[prevYear]) * 100 : 0;
    
    // Decline Rate (average annual decline over last 5 years)
    const recentYears = years.slice(-5);
    const recentValues = recentYears.map(y => yearlyData[y]);
    const decline_rate = recentValues.length >= 2 
      ? ((recentValues[recentValues.length - 1] - recentValues[0]) / recentValues[0] / (recentYears.length - 1)) * 100
      : 0;
    
    // Volatility Score (coefficient of variation)
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    const volatility_score = mean > 0 ? (std / mean) * 100 : 0;
    
    // Consistency Score (inverse of volatility, 0-100)
    const consistency_score = Math.max(0, 100 - volatility_score);
    
    // Relative Performance Index (compare to US average)
    let relative_performance_index = 100;
    if (region !== 'United States') {
      const usPath = path.join(process.cwd(), 'api', 'data', 'cache', 'PET.MCRFPUS1.M.csv');
      if (fs.existsSync(usPath)) {
        const usContent = fs.readFileSync(usPath, 'utf-8');
        const usRecords = parse(usContent, { columns: true, skip_empty_lines: true });
        const usYearlyData: Record<number, number> = {};
        usRecords.forEach((record: any) => {
          const value = parseFloat(record.value);
          if (isNaN(value)) return;
          const recordYear = parseInt(record.period.substring(0, 4));
          if (!usYearlyData[recordYear]) usYearlyData[recordYear] = 0;
          usYearlyData[recordYear] += value;
        });
        
        const usLastYear = Math.max(...Object.keys(usYearlyData).map(Number));
        const usPrevYear = usLastYear - 1;
        const usGrowth = usYearlyData[usPrevYear] 
          ? ((usYearlyData[usLastYear] - usYearlyData[usPrevYear]) / usYearlyData[usPrevYear]) * 100
          : 0;
        
        relative_performance_index = usGrowth !== 0 ? (production_growth_rate / usGrowth) * 100 : 100;
      }
    }
    
    const kpis: CustomKPIs = {
      production_growth_rate: parseFloat(production_growth_rate.toFixed(2)),
      decline_rate: parseFloat(decline_rate.toFixed(2)),
      volatility_score: parseFloat(volatility_score.toFixed(2)),
      relative_performance_index: parseFloat(relative_performance_index.toFixed(2)),
      consistency_score: parseFloat(consistency_score.toFixed(2))
    };
    
    res.status(200).json(kpis);
  } catch (error: any) {
    console.error('Custom KPIs error:', error);
    res.status(500).json({ error: error.message });
  }
}
