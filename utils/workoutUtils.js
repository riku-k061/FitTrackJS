const { backupFile, restoreFromBackup } = require('./transactionUtils');
const { readJSONFile, writeJSONFile } = require('./fileUtils');
const WORKOUTS_FILE = 'workouts.json';

async function prepareDeleteUserWorkouts(userId) {
  await backupFile(WORKOUTS_FILE);
  const workouts = await readJSONFile(WORKOUTS_FILE);
  const userWorkouts = workouts.filter(w => w.userId === userId);
  const updated = workouts.filter(w => w.userId !== userId);

  return {
    execute: async () => {
      await writeJSONFile(WORKOUTS_FILE, updated);
      return { workoutsRemoved: userWorkouts.length };
    },
    rollback: async () => restoreFromBackup(WORKOUTS_FILE)
  };
}

module.exports = { prepareDeleteUserWorkouts };
