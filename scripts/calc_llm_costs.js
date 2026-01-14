const fs = require('fs');
const path = require('path');

const cfgPath = path.join(__dirname, '..', 'tools', 'llm_costs_config.json');
const outCsvPath = path.join(__dirname, '..', 'reports', 'llm_costs_example.csv');

if (!fs.existsSync(cfgPath)) {
  console.error('Config not found at', cfgPath);
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const rates = cfg.rates;
const agents = cfg.agents;
const actions = cfg.actions;

function costFor(agentKey, tier) {
  const agent = agents[agentKey];
  if (!agent) throw new Error('Unknown agent: ' + agentKey);
  const model = agent.model || 'flash';
  const rate = rates[model];
  const inTokens = agent.in[tier];
  const outTokens = agent.out[tier];
  const inCost = (inTokens / 1_000_000) * rate.input_per_1M;
  const outCost = (outTokens / 1_000_000) * rate.output_per_1M;
  return { inTokens, outTokens, inCost, outCost, total: inCost + outCost };
}

function computeActionCost(action, tier) {
  let sum = 0;
  const breakdown = [];
  for (const agentKey in action.calls) {
    const multiplicity = action.calls[agentKey];
    // multiplicity can be fractional (amortized)
    const agentCost = costFor(agentKey, tier);
    const callCost = agentCost.total * multiplicity;
    breakdown.push({ agent: agentKey, multiplicity, agentCost, callCost });
    sum += callCost;
  }
  return { total: sum, breakdown };
}

// CSV header
let csv = 'Action,Notes,Cost_low_USD,Cost_typ_USD,Cost_high_USD\n';
for (const actionName in actions) {
  const action = actions[actionName];
  const low = computeActionCost(action, 'min').total;
  const typ = computeActionCost(action, 'typ').total;
  const high = computeActionCost(action, 'max').total;
  csv += `${actionName.replace(/,/g, '')},"${(action.notes || '').replace(/"/g, '""')}",${low.toFixed(6)},${typ.toFixed(6)},${high.toFixed(6)}\n`;
}

if (!fs.existsSync(path.dirname(outCsvPath))) {
  fs.mkdirSync(path.dirname(outCsvPath), { recursive: true });
}
fs.writeFileSync(outCsvPath, csv);
console.log('Wrote CSV to', outCsvPath);
console.log('\nSample output:');
console.log(csv);

// Also print a more detailed breakdown for "Normal Early" as example
const sample = computeActionCost(actions['Normal Early'], 'typ');
console.log('\nDetailed breakdown for Normal Early (typical):');
sample.breakdown.forEach((b) => {
  console.log(`${b.agent} x${b.multiplicity}: ${b.callCost.toFixed(6)} USD (in ${b.agentCost.inTokens} tokens / out ${b.agentCost.outTokens} tokens)`);
});
console.log('Total typical:', sample.total.toFixed(6), 'USD');
