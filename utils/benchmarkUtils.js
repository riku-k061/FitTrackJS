const { performance } = require('perf_hooks');
const fileService = require('./fileService');

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

async function runBenchmark(testFn, iterations=100, name='Test') {
  const times = [];
  console.log(`↺ Benchmarking ${name} (${iterations} iters)`);
  for (let i=0;i<iterations;i++){
    const start = performance.now();
    await testFn(i);
    times.push(performance.now()-start);
    if(i%10===0) process.stdout.write('.');
  }
  console.log('\nDone');
  const total = times.reduce((a,b)=>a+b,0), avg=total/times.length;
  const sorted=[...times].sort((a,b)=>a-b);
  return {
    name, iterations,
    avgMs:avg.toFixed(2),
    minMs:sorted[0].toFixed(2),
    maxMs:sorted[sorted.length-1].toFixed(2),
    medianMs:sorted[Math.floor(times.length/2)].toFixed(2),
    p95Ms:sorted[Math.floor(times.length*0.95)].toFixed(2),
    p99Ms:sorted[Math.floor(times.length*0.99)].toFixed(2),
    totalMs:total.toFixed(2)
  };
}

async function benchmarkNutritionCreation(iterations=100) {
  const Model = require('../models/nutritionModel');
  const userId='benchmark-user-123';
  fileService.resetMetrics();
  const result = await runBenchmark(async i=>{
    await Model.createNutritionLog({
      userId,
      date:'2025-07-13',
      mealType:['breakfast','lunch','dinner','snack'][i%4],
      calories:500+(i%500),
      protein:20+(i%30),
      carbs:50+(i%50),
      fat:15+(i%20)
    });
  }, iterations, 'Optimized Nutrition Creation');
  const metrics = fileService.getMetrics();
  await fileService.flushAll();
  return { benchmark:result, fileServiceMetrics:metrics };
}

module.exports = { collectBenchmarks, compareBenchmarks, runBenchmark, benchmarkNutritionCreation };
