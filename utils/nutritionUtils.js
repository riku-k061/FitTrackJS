const { backupFile, restoreFromBackup } = require('./transactionUtils');
const { readJSONFile, writeJSONFile } = require('./fileUtils');
const NUTRITION_LOGS_FILE = 'nutritionLogs.json';

async function prepareDeleteUserNutritionLogs(userId) {
  await backupFile(NUTRITION_LOGS_FILE);
  const logs = await readJSONFile(NUTRITION_LOGS_FILE);
  const userLogs = logs.filter(l => l.userId === userId);
  const updated = logs.filter(l => l.userId !== userId);

  return {
    execute: async () => {
      await writeJSONFile(NUTRITION_LOGS_FILE, updated);
      return { logsRemoved: userLogs.length };
    },
    rollback: async () => restoreFromBackup(NUTRITION_LOGS_FILE)
  };
}

module.exports = { prepareDeleteUserNutritionLogs };
