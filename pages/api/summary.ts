import type { NextApiRequest, NextApiResponse } from 'next';

interface SummaryResponse {
  text: string;
  provenance: Record<string, any>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { region, facts } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(200).json({
        text: 'OPENAI_API_KEY not set. To enable AI summaries, set OPENAI_API_KEY as an environment variable.',
        provenance: facts || {}
      });
    }

    const factLines = Object.entries(facts || {}).map(([k, v]) => `- ${k}: ${v}`);
    const prompt = 
      'You are an assistant that summarizes energy data for decision makers. ' +
      'Use only the facts provided below and label any inference clearly. ' +
      'Provide a 3-sentence executive summary and one bullet list of recommended next steps.\n\n' +
      'FACTS:\n' +
      factLines.join('\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are concise and factual.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.error?.code === 'insufficient_quota') {
        return res.status(200).json({
          text: '⚠️ OpenAI API quota exceeded. Please add credits at https://platform.openai.com/account/billing or use a different API key.',
          provenance: facts || {}
        });
      }
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const text = data.choices[0].message.content.trim();

    res.status(200).json({
      text,
      provenance: facts || {}
    });
  } catch (error: any) {
    console.error('Summary API error:', error);
    res.status(500).json({ 
      text: `Error generating summary: ${error.message}`,
      provenance: {}
    });
  }
}
