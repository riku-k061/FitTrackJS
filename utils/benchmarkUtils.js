const { performance } = require('perf_hooks');

function calculateStats(arr) {
  const sorted = [...arr].sort((a,b)=>a-b);
  const sum = sorted.reduce((s,v)=>s+v,0);
  const avg = sum/arr.length;
  const sq = sorted.reduce((s,v)=>s+Math.pow(v-avg,2),0);
  const std = Math.sqrt(sq/arr.length);
  return {
    min: sorted[0],
    max: sorted.at(-1),
    avg,
    median: sorted[Math.floor(arr.length/2)],
    p95: sorted[Math.floor(arr.length*0.95)],
    p99: sorted[Math.floor(arr.length*0.99)],
    stdDev: std
  };
}

async function collectBenchmarks(name, fn, iters=100) {
  const results = [];
  for (let i=0;i<iters;i++){
    const start = performance.now();
    await fn();
    results.push(performance.now()-start);
  }
  const stats = calculateStats(results);
  console.log(`${name} (n=${iters}):`, stats);
  return stats;
}

function compareBenchmarks(baseName, baseStats, optName, optStats) {
  const imp = ((baseStats.avg - optStats.avg)/baseStats.avg)*100;
  console.log(`Improvement (${baseName} → ${optName}): ${imp.toFixed(2)}%`);
}

module.exports = { collectBenchmarks, compareBenchmarks };
