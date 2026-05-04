import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface RegionData {
  production: number;
  yoy_change: number;
  trend: string;
}

const REGION_TO_SERIES: Record<string, string> = {
  'United States': 'PET.MCRFPUS1.M',
  'Alabama': 'PET.MCRFPAL2.M',
  'Alaska': 'PET.MCRFPAK2.M',
  'Arizona': 'PET.MCRFPAZ2.M',
  'Arkansas': 'PET.MCRFPAR2.M',
  'California': 'PET.MCRFPCA2.M',
  'Colorado': 'PET.MCRFPCO2.M',
  'Connecticut': 'PET.MCRFPCT2.M',
  'Delaware': 'PET.MCRFPDE2.M',
  'Florida': 'PET.MCRFPFL2.M',
  'Georgia': 'PET.MCRFPGA2.M',
  'Hawaii': 'PET.MCRFPHI2.M',
  'Idaho': 'PET.MCRFPID2.M',
  'Illinois': 'PET.MCRFPIL2.M',
  'Indiana': 'PET.MCRFPIN2.M',
  'Iowa': 'PET.MCRFPIA2.M',
  'Kansas': 'PET.MCRFPKS2.M',
  'Kentucky': 'PET.MCRFPKY2.M',
  'Louisiana': 'PET.MCRFPLA2.M',
  'Maine': 'PET.MCRFPME2.M',
  'Maryland': 'PET.MCRFPMD2.M',
  'Massachusetts': 'PET.MCRFPMA2.M',
  'Michigan': 'PET.MCRFPMI2.M',
  'Minnesota': 'PET.MCRFPMN2.M',
  'Mississippi': 'PET.MCRFPMS2.M',
  'Missouri': 'PET.MCRFPMO2.M',
  'Montana': 'PET.MCRFPMT2.M',
  'Nebraska': 'PET.MCRFPNE2.M',
  'Nevada': 'PET.MCRFPNV2.M',
  'New Hampshire': 'PET.MCRFPNH2.M',
  'New Jersey': 'PET.MCRFPNJ2.M',
  'New Mexico': 'PET.MCRFPNM2.M',
  'New York': 'PET.MCRFPNY2.M',
  'North Carolina': 'PET.MCRFPNC2.M',
  'North Dakota': 'PET.MCRFPND2.M',
  'Ohio': 'PET.MCRFPOH2.M',
  'Oklahoma': 'PET.MCRFPOK2.M',
  'Oregon': 'PET.MCRFPOR2.M',
  'Pennsylvania': 'PET.MCRFPPA2.M',
  'Rhode Island': 'PET.MCRFPRI2.M',
  'South Carolina': 'PET.MCRFPSC2.M',
  'South Dakota': 'PET.MCRFPSD2.M',
  'Tennessee': 'PET.MCRFPTN2.M',
  'Texas': 'PET.MCRFPTX2.M',
  'Utah': 'PET.MCRFPUT2.M',
  'Vermont': 'PET.MCRFPVT2.M',
  'Virginia': 'PET.MCRFPVA2.M',
  'Washington': 'PET.MCRFPWA2.M',
  'West Virginia': 'PET.MCRFPWV2.M',
  'Wisconsin': 'PET.MCRFPWI2.M',
  'Wyoming': 'PET.MCRFPWY2.M',
};

function calculateMetrics(values: number[]): RegionData {
  if (values.length === 0) {
    return { production: 0, yoy_change: 0, trend: 'unknown' };
  }

  const latest = values[values.length - 1];
  const previous = values.length > 1 ? values[values.length - 2] : latest;
  
  const yoyChange = previous !== 0 ? ((latest - previous) / previous) * 100 : 0;
  
  let trend = 'stable';
  if (yoyChange > 2) trend = 'increasing';
  else if (yoyChange < -2) trend = 'decreasing';

  return {
    production: latest,
    yoy_change: yoyChange,
    trend
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const regionsData: Record<string, RegionData> = {};
    
    for (const [regionName, seriesId] of Object.entries(REGION_TO_SERIES)) {
      try {
        const cachePath = path.join(process.cwd(), 'api', 'data', 'cache', `${seriesId}.csv`);
        
        if (!fs.existsSync(cachePath)) {
          regionsData[regionName] = { production: 0, yoy_change: 0, trend: 'unknown' };
          continue;
        }

        const csvContent = fs.readFileSync(cachePath, 'utf-8');
        const records = parse(csvContent, { columns: true, skip_empty_lines: true });
        
        // Aggregate by year and sum values
        const yearlyData: Record<number, number> = {};
        records.forEach((record: any) => {
          const period = record.period;
          const value = parseFloat(record.value);
          
          if (isNaN(value)) return;
          
          // Extract year from period (YYYYMM format)
          const year = parseInt(period.substring(0, 4));
          if (!yearlyData[year]) yearlyData[year] = 0;
          yearlyData[year] += value;
        });
        
        const years = Object.keys(yearlyData).map(Number).sort();
        const values = years.map(year => yearlyData[year]);
        
        regionsData[regionName] = calculateMetrics(values);
      } catch (error) {
        console.error(`Error processing ${regionName}:`, error);
        regionsData[regionName] = { production: 0, yoy_change: 0, trend: 'unknown' };
      }
    }
    
    res.status(200).json(regionsData);
  } catch (error: any) {
    console.error('Regions API error:', error);
    res.status(500).json({ error: error.message });
  }
}
