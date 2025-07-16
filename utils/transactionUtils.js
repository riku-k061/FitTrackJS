const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

async function executeTransaction(operations) {
  const results = [], executed = [];
  try {
    for (const op of operations) {
      results.push(await op.execute());
      executed.push(op);
    }
    return results;
  } catch (err) {
    console.error('Transaction failed:', err);
    for (let i = executed.length - 1; i >= 0; i--) {
      try { await executed[i].rollback(); } catch (e) { console.error('Rollback failed:', e); }
    }
    throw err;
  }
}

async function backupFile(filename) {
  const src = path.join(config.dataPath, filename);
  const dest = path.join(config.dataPath, `${filename}.bak`);
  try {
    await fs.access(src);
    await fs.copyFile(src, dest);
  } catch (e) {
    await fs.writeFile(dest, '[]');
  }
  return dest;
}

async function restoreFromBackup(filename) {
  const bak = path.join(config.dataPath, `${filename}.bak`);
  const dst = path.join(config.dataPath, filename);
  await fs.copyFile(bak, dst);
  await fs.unlink(bak);
}

module.exports = { executeTransaction, backupFile, restoreFromBackup };
