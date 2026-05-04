import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const EIA_API_KEY = process.env.EIA_API_KEY || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const region = (req.query.region as string) || 'United States';
    
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
    
    let lastUpdated: string | null = null;
    let dataSource = 'cache';
    
    // Check cache timestamp
    if (fs.existsSync(cachePath)) {
      const stats = fs.statSync(cachePath);
      lastUpdated = stats.mtime.toISOString();
    }
    
    // Try to fetch fresh data if API key is available
    if (EIA_API_KEY && req.query.force === 'true') {
      try {
        const response = await axios.get(`https://api.eia.gov/v2/petroleum/crd/crpdn/data/`, {
          params: {
            api_key: EIA_API_KEY,
            frequency: 'monthly',
            'data[0]': 'value',
            'facets[series][]': seriesId,
            sort: { period: 'asc' },
            length: 5000
          },
          timeout: 10000
        });
        
        if (response.data && response.data.response && response.data.response.data) {
          // Convert to CSV format
          const data = response.data.response.data;
          let csv = 'period,series,value\n';
          data.forEach((row: any) => {
            csv += `${row.period},${row.series},${row.value}\n`;
          });
          
          // Update cache
          fs.writeFileSync(cachePath, csv);
          lastUpdated = new Date().toISOString();
          dataSource = 'live';
        }
      } catch (apiError: any) {
        console.error('EIA API error:', apiError.message);
        // Fall back to cache
        dataSource = 'cache-fallback';
      }
    }
    
    res.status(200).json({
      region,
      seriesId,
      lastUpdated,
      dataSource,
      cacheAvailable: fs.existsSync(cachePath),
      message: dataSource === 'live' 
        ? 'Data refreshed successfully from EIA API'
        : dataSource === 'cache-fallback'
        ? 'API unavailable, using cached data'
        : 'Using cached data (set force=true to refresh)'
    });
  } catch (error: any) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: error.message });
  }
}
