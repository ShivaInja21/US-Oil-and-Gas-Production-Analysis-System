import type { NextApiRequest, NextApiResponse } from 'next';

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

function calculateDecliningProduction(
  initialRate: number,
  declineRate: number,
  months: number
): number[] {
  const production: number[] = [];
  for (let i = 0; i < months; i++) {
    production.push(initialRate * Math.exp(-declineRate * i / 12));
  }
  return production;
}

function calculateNPV(cashFlows: number[], discountRate: number): number {
  return cashFlows.reduce((npv, cf, i) => {
    return npv + cf / Math.pow(1 + discountRate / 12, i);
  }, 0);
}

function calculateIRR(cashFlows: number[], guess: number = 0.1): number {
  const maxIterations = 100;
  const tolerance = 0.0001;
  let rate = guess;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let derivative = 0;
    
    for (let j = 0; j < cashFlows.length; j++) {
      const factor = Math.pow(1 + rate / 12, j);
      npv += cashFlows[j] / factor;
      derivative -= j * cashFlows[j] / (12 * factor * (1 + rate / 12));
    }
    
    if (Math.abs(npv) < tolerance) {
      return rate * 12; // Annualized
    }
    
    rate = rate - npv / derivative;
    
    if (rate < -0.99) rate = -0.99;
    if (rate > 10) rate = 10;
  }
  
  return rate * 12;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const {
      initialRate = 1000,
      declineRate = 0.3,
      drillingCost = 5000000,
      opex = 50000,
      oilPrice = 70,
      gasPrice = 3,
      discountRate = 0.1,
      months = 120
    } = req.body;
    
    // Calculate monthly production
    const monthlyProduction = calculateDecliningProduction(
      parseFloat(initialRate),
      parseFloat(declineRate),
      parseInt(months)
    );
    
    // Calculate cumulative production (EUR)
    const cumulativeProduction: number[] = [];
    let cumSum = 0;
    monthlyProduction.forEach(prod => {
      cumSum += prod;
      cumulativeProduction.push(cumSum);
    });
    const eur = cumulativeProduction[cumulativeProduction.length - 1];
    
    // Calculate monthly revenue
    const monthlyRevenue = monthlyProduction.map(prod => prod * parseFloat(oilPrice));
    
    // Calculate monthly cash flow
    const monthlyCashFlow: number[] = [];
    const opexMonthly = parseFloat(opex);
    monthlyRevenue.forEach((rev, i) => {
      const cf = i === 0 
        ? rev - opexMonthly - parseFloat(drillingCost)
        : rev - opexMonthly;
      monthlyCashFlow.push(cf);
    });
    
    // Calculate cumulative cash flow
    const cumulativeCashFlow: number[] = [];
    let cumCF = 0;
    monthlyCashFlow.forEach(cf => {
      cumCF += cf;
      cumulativeCashFlow.push(cumCF);
    });
    
    // Calculate NPV
    const npv = calculateNPV(monthlyCashFlow, parseFloat(discountRate));
    
    // Calculate IRR
    const irr = calculateIRR(monthlyCashFlow);
    
    // Calculate payback period
    let paybackMonths: number | null = null;
    for (let i = 0; i < cumulativeCashFlow.length; i++) {
      if (cumulativeCashFlow[i] >= 0) {
        paybackMonths = i;
        break;
      }
    }
    
    const economics: WellEconomics = {
      monthly_production: monthlyProduction.map(p => parseFloat(p.toFixed(2))),
      cumulative_production: cumulativeProduction.map(p => parseFloat(p.toFixed(2))),
      monthly_revenue: monthlyRevenue.map(r => parseFloat(r.toFixed(2))),
      monthly_cash_flow: monthlyCashFlow.map(cf => parseFloat(cf.toFixed(2))),
      cumulative_cash_flow: cumulativeCashFlow.map(cf => parseFloat(cf.toFixed(2))),
      eur: parseFloat(eur.toFixed(2)),
      npv: parseFloat(npv.toFixed(2)),
      irr: parseFloat((irr * 100).toFixed(2)),
      payback_months: paybackMonths
    };
    
    res.status(200).json(economics);
  } catch (error: any) {
    console.error('Well economics error:', error);
    res.status(500).json({ error: error.message });
  }
}
