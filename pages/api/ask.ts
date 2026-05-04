import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question, region, kpi } = req.body;
    
    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({
        answer: 'AI features are not available. Please set OPENAI_API_KEY environment variable.',
        data_sources: [],
        is_inference: true
      });
    }
    
    // If OpenAI is available, make the API call
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an energy data analyst assistant. Answer questions using ONLY the provided data context. Always cite specific numbers from the data. If you make any inference beyond the raw data, explicitly state "INFERENCE:" before that part. Keep answers concise (2-3 sentences max).'
          },
          {
            role: 'user',
            content: `DATA CONTEXT:\n${JSON.stringify({ region, ...kpi }, null, 2)}\n\nQUESTION: ${question}`
          }
        ],
        max_tokens: 250,
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      if (error.error?.code === 'insufficient_quota') {
        return res.status(200).json({
          answer: '⚠️ OpenAI API quota exceeded. Please add credits at https://platform.openai.com/account/billing',
          data_sources: [],
          is_inference: false
        });
      }
      throw new Error(error.error?.message || 'OpenAI API error');
    }
    
    const data = await response.json();
    const answer = data.choices[0]?.message?.content?.trim() || 'No response generated';
    
    // Detect if answer contains inference
    const isInference = /INFERENCE|LIKELY|MAY/i.test(answer);
    
    // Extract data sources
    const dataSources: string[] = [];
    if (region) dataSources.push(`Region: ${region}`);
    if (kpi?.label) dataSources.push(`KPI: ${kpi.label}`);
    
    res.status(200).json({
      answer,
      data_sources: dataSources,
      is_inference: isInference
    });
  } catch (error: any) {
    console.error('Ask API error:', error);
    res.status(500).json({ 
      answer: `Error: ${error.message}`,
      data_sources: [],
      is_inference: false
    });
  }
}
