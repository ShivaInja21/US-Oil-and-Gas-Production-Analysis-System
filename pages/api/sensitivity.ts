import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface SensitivityCell {
  declineRate: number;
  price: number;
  production: number;
  revenue: number;
  quality: 'weak' | 'moderate' | 'strong';
}

const REGION_TO_SERIES: Record<string, string> = {
  'United States': 'PET.MCRFPUS1.M',
  'Texas': 'PET.MCRFPTX2.M',
  'North Dakota': 'PET.MCRFPND2.M',
  'New Mexico': 'PET.MCRFPNM2.M',
  'Oklahoma': 'PET.MCRFPOK2.M',
  'Colorado': 'PET.MCRFPCO2.M',
};

function linearForecast(values: number[], years: number, declineRate: number): number[] {
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = values;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  let slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Adjust slope by decline rate
  slope = slope * (1 + declineRate);
  
  const forecasts: number[] = [];
  for (let i = 0; i < years; i++) {
    forecasts.push(Math.max(0, slope * (n + i) + intercept));
  }
  
  return forecasts;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const region = (req.query.region as string) || 'United States';
    const year = parseInt(req.query.year as string) || 2026;
    
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
    const lastActualYear = years[years.length - 1];
    
    // Define sensitivity ranges
    const declineRates = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3]; // -30% to +30%
    const prices = [30, 40, 50, 60, 70, 80, 90]; // USD per barrel
    
    const matrix: SensitivityCell[][] = [];
    
    declineRates.forEach(declineRate => {
      const row: SensitivityCell[] = [];
      
      prices.forEach(price => {
        const forecastHorizon = year - lastActualYear;
        const forecasts = forecastHorizon > 0 
          ? linearForecast(values, forecastHorizon, declineRate)
          : [];
        
        let production = forecastHorizon > 0 
          ? forecasts[forecasts.length - 1]
          : yearlyData[year] || 0;
        
        // Apply price elasticity: higher prices incentivize more production
        // Using $60 as baseline, with 0.3% production change per $10 price change
        const priceElasticity = 0.003;
        const baselinePrice = 60;
        const priceMultiplier = 1 + (price - baselinePrice) * priceElasticity;
        production = production * priceMultiplier;
        
        const revenue = production * price;
        
        // Quality assessment
        let quality: 'weak' | 'moderate' | 'strong';
        if (revenue < 1000000) quality = 'weak';
        else if (revenue < 5000000) quality = 'moderate';
        else quality = 'strong';
        
        row.push({
          declineRate,
          price,
          production: parseFloat(production.toFixed(2)),
          revenue: parseFloat(revenue.toFixed(2)),
          quality
        });
      });
      
      matrix.push(row);
    });
    
    res.status(200).json({
      region,
      year,
      declineRates,
      prices,
      matrix
    });
  } catch (error: any) {
    console.error('Sensitivity analysis error:', error);
    res.status(500).json({ error: error.message });
  }
}
