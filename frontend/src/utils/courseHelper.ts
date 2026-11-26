/**
 * Utility to identify whether an AP Economics task belongs to
 * Microeconomics, Macroeconomics, or Exam Prep.
 */
export const getEconomicsTrackLabel = (task: {
  title: string;
  topic_code?: string;
  description?: string;
}): string | null => {
  const code = (task.topic_code || '').toUpperCase();
  const text = `${task.title} ${task.description || ''}`.toLowerCase();

  // 1. Direct match on topic code
  if (code.includes('MIC') || code.startsWith('AP-MIC')) return 'Microeconomics';
  if (code.includes('MAC') || code.startsWith('AP-MAC')) return 'Macroeconomics';
  if (code.includes('REV') || code.startsWith('AP-REV') || code.includes('STRAT')) return 'Exam Prep';

  // 2. Keyword detection for Macroeconomics (check Macro first for distinct terms)
  if (
    text.includes('macroeconomic') ||
    text.includes('circular flow') ||
    text.includes('gross domestic product') ||
    text.includes('gdp') ||
    text.includes('unemployment') ||
    text.includes('inflation') ||
    text.includes('cpi') ||
    text.includes('ad-as') ||
    text.includes('aggregate demand') ||
    text.includes('aggregate supply') ||
    text.includes('fiscal policy') ||
    text.includes('monetary policy') ||
    text.includes('financial sector') ||
    text.includes('money market') ||
    text.includes('banking') ||
    text.includes('federal reserve') ||
    text.includes('phillips curve') ||
    text.includes('foreign exchange') ||
    text.includes('balance of payments') ||
    text.includes('national income') ||
    text.includes('stabilization') ||
    text.includes('open economy') ||
    text.includes('business cycle') ||
    text.includes('economic indicators')
  ) {
    return 'Macroeconomics';
  }

  // 3. Keyword detection for Exam Prep / Strategy
  if (
    text.includes('exam prep') ||
    text.includes('exam strategy') ||
    text.includes('frq scoring workshop') ||
    text.includes('dual graph mastery') ||
    text.includes('diagnostic planning') ||
    text.includes('teacher-decided sequencing')
  ) {
    return 'Exam Prep';
  }

  // 4. Keyword detection for Microeconomics
  if (
    text.includes('microeconomic') ||
    text.includes('comparative advantage') ||
    text.includes('production possibilities') ||
    text.includes('ppc') ||
    text.includes('elasticity') ||
    text.includes('consumer choice') ||
    text.includes('marginal analysis') ||
    text.includes('perfect competition') ||
    text.includes('imperfect competition') ||
    text.includes('monopoly') ||
    text.includes('oligopoly') ||
    text.includes('monopolistic') ||
    text.includes('factor market') ||
    text.includes('resource market') ||
    text.includes('deadweight loss') ||
    text.includes('externalities') ||
    text.includes('market failure') ||
    text.includes('public goods') ||
    text.includes('gini') ||
    text.includes('cost curve') ||
    text.includes('diminishing returns') ||
    text.includes('surplus') ||
    text.includes('basic economic concepts')
  ) {
    return 'Microeconomics';
  }

  return null;
};

export interface APUnitWeightage {
  unitNumber: number;
  title: string;
  weightage: string;
  isHighYield: boolean;
  track: 'Microeconomics' | 'Macroeconomics';
  coreTopics: string[];
}

export const AP_MICRO_WEIGHTAGE: APUnitWeightage[] = [
  {
    unitNumber: 1,
    title: 'Basic Economic Concepts',
    weightage: '12%–15%',
    isHighYield: false,
    track: 'Microeconomics',
    coreTopics: ['Scarcity & Opportunity Cost', 'Production Possibilities Curve (PPC)', 'Comparative Advantage & Trade', 'Marginal Analysis & Utility'],
  },
  {
    unitNumber: 2,
    title: 'Supply and Demand',
    weightage: '20%–25%',
    isHighYield: true,
    track: 'Microeconomics',
    coreTopics: ['Market Equilibrium & Shifts', 'Elasticity (Price, Income, Cross)', 'Consumer & Producer Surplus', 'Government Interventions & Deadweight Loss'],
  },
  {
    unitNumber: 3,
    title: 'Production, Cost, and the Perfect Competition Model',
    weightage: '22%–25%',
    isHighYield: true,
    track: 'Microeconomics',
    coreTopics: ['Short-Run & Long-Run Cost Curves', 'Diminishing Marginal Returns', 'Profit Maximization (MR=MC)', 'Perfect Competition Long-Run Equilibrium'],
  },
  {
    unitNumber: 4,
    title: 'Imperfect Competition',
    weightage: '15%–22%',
    isHighYield: true,
    track: 'Microeconomics',
    coreTopics: ['Monopoly & Price Discrimination', 'Monopolistic Competition', 'Oligopoly & Game Theory Matrix', 'Collusion & Nash Equilibrium'],
  },
  {
    unitNumber: 5,
    title: 'Factor Markets',
    weightage: '10%–13%',
    isHighYield: false,
    track: 'Microeconomics',
    coreTopics: ['Derived Demand for Resources', 'Marginal Revenue Product (MRP)', 'Marginal Resource Cost (MRC)', 'Monopsony in Labor Markets'],
  },
  {
    unitNumber: 6,
    title: 'Market Failure and the Role of Government',
    weightage: '8%–13%',
    isHighYield: false,
    track: 'Microeconomics',
    coreTopics: ['Positive & Negative Externalities', 'Public Goods & Free-Rider Dilemma', 'Income Inequality & Gini Coefficient', 'Corrective Taxes & Subsidies'],
  },
];

export const AP_MACRO_WEIGHTAGE: APUnitWeightage[] = [
  {
    unitNumber: 1,
    title: 'Basic Economic Concepts',
    weightage: '5%–10%',
    isHighYield: false,
    track: 'Macroeconomics',
    coreTopics: ['Circular Flow of Economic Activity', 'Scarcity & Production Frontiers', 'Real vs. Nominal Variables', 'Specialization & Gains from Trade'],
  },
  {
    unitNumber: 2,
    title: 'Economic Indicators and the Business Cycle',
    weightage: '12%–17%',
    isHighYield: false,
    track: 'Macroeconomics',
    coreTopics: ['GDP Calculation & Real GDP', 'Unemployment Types & Natural Rate (NRU)', 'Inflation Indices, CPI & GDP Deflator', 'Business Cycle Fluctuations'],
  },
  {
    unitNumber: 3,
    title: 'National Income and Price Determination',
    weightage: '17%–27%',
    isHighYield: true,
    track: 'Macroeconomics',
    coreTopics: ['Aggregate Demand (AD) & Aggregate Supply (AS)', 'Short-Run vs. Long-Run Equilibrium', 'Spending & Tax Multipliers', 'Fiscal Policy Stabilizers'],
  },
  {
    unitNumber: 4,
    title: 'Financial Sector',
    weightage: '18%–23%',
    isHighYield: true,
    track: 'Macroeconomics',
    coreTopics: ['Money Assets & Banking System', 'Money Market & Loanable Funds Market', 'Central Bank & Monetary Policy Tools', 'Nominal vs. Real Interest Rates'],
  },
  {
    unitNumber: 5,
    title: 'Long-Run Consequences of Stabilization Policies',
    weightage: '20%–30%',
    isHighYield: true,
    track: 'Macroeconomics',
    coreTopics: ['Short-Run & Long-Run Phillips Curves', 'Government Deficits & National Debt', 'Crowding-Out Effect', 'Economic Growth & Productivity'],
  },
  {
    unitNumber: 6,
    title: 'Open Economy — International Trade and Finance',
    weightage: '10%–13%',
    isHighYield: false,
    track: 'Macroeconomics',
    coreTopics: ['Balance of Payments (Current & Financial)', 'Foreign Exchange Market (Forex)', 'Currency Appreciation & Depreciation', 'Capital Flows & Exchange Rates'],
  },
];

/**
 * Resolves the course brand/category (EduQuest, MBA Wizards, or Aptech)
 * based on course category, title, or code.
 */
export const getCourseBrand = (
  category?: string | null,
  name?: string | null,
  code?: string | null
): 'EduQuest' | 'MBA Wizards' | 'Aptech' => {
  const cat = (category || '').trim();
  const lowerCat = cat.toLowerCase();
  if (lowerCat === 'eduquest') return 'EduQuest';
  if (lowerCat === 'mba wizards' || lowerCat === 'mbawizards' || lowerCat === 'mba') return 'MBA Wizards';
  if (lowerCat === 'aptech') return 'Aptech';

  const text = `${category || ''} ${name || ''} ${code || ''}`.toLowerCase();
  if (
    text.includes('mba') ||
    text.includes('cat ') ||
    text.includes('gmat') ||
    text.includes('gre') ||
    text.includes('snap') ||
    text.includes('nmat') ||
    text.includes('xat')
  ) {
    return 'MBA Wizards';
  }
  if (
    text.includes('eduquest') ||
    text.includes('ap ') ||
    text.includes('ap-') ||
    text.includes('sat') ||
    text.includes('act') ||
    text.includes('ucat') ||
    text.includes('micro') ||
    text.includes('macro') ||
    text.includes('economic') ||
    text.includes('college board')
  ) {
    return 'EduQuest';
  }
  return 'Aptech';
};

