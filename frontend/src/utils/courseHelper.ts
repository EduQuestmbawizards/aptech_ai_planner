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
  if (code.includes('REV') || code.startsWith('AP-REV')) return 'Exam Prep';

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
    text.includes('national income')
  ) {
    return 'Macroeconomics';
  }

  // 3. Keyword detection for Microeconomics
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
    text.includes('cost curve') ||
    text.includes('diminishing returns') ||
    text.includes('surplus')
  ) {
    return 'Microeconomics';
  }

  return null;
};
