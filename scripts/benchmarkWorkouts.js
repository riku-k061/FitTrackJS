#!/usr/bin/env node
const { v4: uuidv4 } = require('uuid');
const { collectBenchmarks, compareBenchmarks } = require('../utils/benchmarkUtils');
const { 
  readDataFile: origRead, 
  writeDataFile: origWrite 
} = require('fs').promises;
const path = require('path');
const { createWorkout: optimizedCreate, flushAllWrites } = require('../utils/workoutUtils');

async function standardWrite(workout){
  const fp = 'data/workouts.json';
  const full = path.join(process.cwd(),fp);
  let arr;
  try { arr = JSON.parse(await origRead(full,'utf8')); }
  catch{ arr=[]; }
  arr.push(workout);
  await origWrite(full, JSON.stringify(arr,null,2));
}

function makeWorkout() {
  return {
    id: uuidv4(),
    userId: uuidv4(),
    date: new Date().toISOString(),
    exerciseType: ['cardio','strength','flexibility'][Math.floor(Math.random()*3)],
    duration: Math.floor(Math.random()*60)+10,
    caloriesBurned: Math.floor(Math.random()*500)+100,
    reps: Math.floor(Math.random()*20)+5,
    sets: Math.floor(Math.random()*5)+1
  };
}

async function run() {
  console.log('Standard I/O benchmark');
  const baseStats = await collectBenchmarks('Standard I/O', async ()=>{
    await standardWrite(makeWorkout());
  },100);

  console.log('Optimized I/O benchmark');
  const optStats = await collectBenchmarks('Optimized I/O', async ()=>{
    await optimizedCreate(makeWorkout());
  },100);

  compareBenchmarks('Standard I/O', baseStats, 'Optimized I/O', optStats);

  await flushAllWrites();
}

run().catch(e=>{ console.error(e); process.exit(1); });
