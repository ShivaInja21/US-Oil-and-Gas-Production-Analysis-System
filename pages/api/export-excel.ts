import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const region = (req.query.region as string) || 'United States';
    const year = parseInt(req.query.year as string) || 2026;
    const price = parseFloat(req.query.price as string) || 50;
    
    const REGION_TO_SERIES: Record<string, string> = {
      'United States': 'PET.MCRFPUS1.M',
      'Texas': 'PET.MCRFPTX2.M',
      'North Dakota': 'PET.MCRFPND2.M',
      'New Mexico': 'PET.MCRFPNM2.M',
      'Oklahoma': 'PET.MCRFPOK2.M',
      'Colorado': 'PET.MCRFPCO2.M',
    };
    
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
    
    // Build CSV with formulas (Excel-compatible)
    let csv = 'Energy Intelligence System - Export\n';
    csv += `Region:,${region}\n`;
    csv += `Export Date:,${new Date().toISOString().split('T')[0]}\n`;
    csv += `Data Source:,EIA API (${seriesId})\n`;
    csv += '\n';
    
    // Editable inputs section
    csv += 'EDITABLE INPUTS\n';
    csv += 'Parameter,Value,Unit\n';
    csv += `Price per Barrel,${price},USD\n`;
    csv += `Forecast Year,${year},Year\n`;
    csv += `Growth Rate Assumption,0.05,Fraction\n`;
    csv += '\n';
    
    // Historical data
    csv += 'HISTORICAL DATA\n';
    csv += 'Year,Production (barrels),YoY Change (%),Revenue (USD)\n';
    
    years.forEach((y, idx) => {
      const prod = yearlyData[y];
      const prevProd = idx > 0 ? yearlyData[years[idx - 1]] : prod;
      const yoyChange = idx > 0 ? ((prod - prevProd) / prevProd * 100).toFixed(2) : '0.00';
      // Formula: =B{row}*$B$7 (where B7 is price)
      csv += `${y},${prod.toFixed(2)},${yoyChange},=B${idx + 13}*$B$7\n`;
    });
    
    csv += '\n';
    csv += 'FORECAST CALCULATIONS\n';
    csv += 'Year,Projected Production,Formula,Estimated Revenue\n';
    
    const lastYear = years[years.length - 1];
    const lastValue = yearlyData[lastYear];
    const forecastYears = Array.from({ length: 10 }, (_, i) => lastYear + i + 1);
    
    forecastYears.forEach((y, idx) => {
      const rowNum = years.length + 16 + idx;
      if (idx === 0) {
        csv += `${y},=B${years.length + 12}*(1+$B$9),Linear projection,=B${rowNum}*$B$7\n`;
      } else {
        csv += `${y},=B${rowNum - 1}*(1+$B$9),Compound growth,=B${rowNum}*$B$7\n`;
      }
    });
    
    csv += '\n';
    csv += 'KPI SUMMARY\n';
    csv += 'Metric,Value,Formula\n';
    csv += `Total Historical Production,=SUM(B13:B${12 + years.length}),Sum of historical\n`;
    csv += `Average Annual Production,=AVERAGE(B13:B${12 + years.length}),Mean of historical\n`;
    csv += `Total Forecast Revenue,=SUM(D${years.length + 16}:D${years.length + 25}),Sum of forecast revenue\n`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="energy-forecast-${region.replace(/\s+/g, '-')}-${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (error: any) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: error.message });
  }
}
