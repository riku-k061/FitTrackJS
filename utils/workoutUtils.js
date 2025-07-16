// utils/workoutUtils.js
const { readDataFile, writeDataFile } = require('./fileUtils');
const { executeTransaction } = require('./transactionUtils');
const { logAuditEvent } = require('./auditLogUtils');
const { WorkoutLog } = require('../models/workoutModel');
const { getFilteredData, invalidateIndex } = require('./indexingUtils');
const { enrichWorkoutsWithUserInfo } = require('./userCacheUtils');
const { backupFile, restoreFromBackup } = require('./transactionUtils');
const { readJSONFile, writeJSONFile } = require('./fileUtils');
const WORKOUT_FILE = 'data/workouts.json';


async function getWorkouts(options = {}) {
  const { includeUser = true, userFields = ['name', 'email'], ...filterOptions } = options;
  const result = await getFilteredData(WORKOUT_FILE, filterOptions);
  if (includeUser) {
    result.data = await enrichWorkoutsWithUserInfo(result.data, userFields);
  }
  return result;
}

async function getWorkoutById(id, includeUser = true) {
  const workouts = await readDataFile(WORKOUT_FILE);
  const workout = workouts.find(w => w.id === id);
  if (!workout) return null;
  if (includeUser) {
    const [enriched] = await enrichWorkoutsWithUserInfo([workout]);
    return enriched;
  }
  return workout;
}

async function createWorkout(workoutData) {
  const workout = await WorkoutLog.create(workoutData);
  const workouts = await readDataFile(WORKOUT_FILE);

  const result = await executeTransaction([{
    execute: async () => {
      workouts.push(workout.toJSON());
      await writeDataFile(WORKOUT_FILE, workouts);
      invalidateIndex(WORKOUT_FILE);
      const [enriched] = await enrichWorkoutsWithUserInfo([workout.toJSON()]);
      return enriched;
    },
    rollback: async () => {}
  }]);

  return result[0];
}

async function updateWorkout(id, workoutData) {
  const workouts = await readDataFile(WORKOUT_FILE);
  const idx = workouts.findIndex(w => w.id === id);
  if (idx === -1) throw new Error(`Workout ${id} not found`);

  const oldWorkout = workouts[idx];
  const updatedData = { ...oldWorkout, ...workoutData, id };
  const workout = await WorkoutLog.create(updatedData);

  const result = await executeTransaction([{
    execute: async () => {
      workouts[idx] = workout.toJSON();
      await writeDataFile(WORKOUT_FILE, workouts);
      invalidateIndex(WORKOUT_FILE);
      const [enriched] = await enrichWorkoutsWithUserInfo([workout.toJSON()]);
      return enriched;
    },
    rollback: async () => {}
  }]);

  return result[0];
}

async function deleteWorkout(id, userId) {
  const workouts = await readDataFile(WORKOUT_FILE);
  const idx = workouts.findIndex(w => w.id === id);
  if (idx === -1) throw new Error(`Workout ${id} not found`);

  const toDelete = workouts[idx];

  const result = await executeTransaction([{
    execute: async () => {
      workouts.splice(idx, 1);
      await writeDataFile(WORKOUT_FILE, workouts);
      invalidateIndex(WORKOUT_FILE);
      return toDelete;
    },
    rollback: async () => {}
  }]);

  return result[0];
}
async function prepareDeleteUserWorkouts(userId) {
  await backupFile('workouts.json');
  const workouts = await readJSONFile('workouts.json');
  const userWorkouts = workouts.filter(w => w.userId === userId);
  const updated = workouts.filter(w => w.userId !== userId);

  return {
    execute: async () => {
      await writeJSONFile('workouts.json', updated);
      return { workoutsRemoved: userWorkouts.length };
    },
    rollback: async () => restoreFromBackup('workouts.json')
  };
}

module.exports = {
  getWorkouts,
  getWorkoutById,
  createWorkout,
  updateWorkout,
  deleteWorkout,
  prepareDeleteUserWorkouts
};
