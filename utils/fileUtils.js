const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

// In-memory cache, write queue, locks and timers
const fileCache = {};
const writeQueue = {};
const fileLocks = {};
const batchTimers = {};
const BATCH_INTERVAL = 100;

function initializeCache(filename) {
  if (!(filename in fileCache)) fileCache[filename] = null;
  if (!(filename in writeQueue)) writeQueue[filename] = [];
  if (!(filename in fileLocks)) fileLocks[filename] = false;
}

async function readJSONFile(filename) {
  initializeCache(filename);
  if (fileCache[filename] !== null) {
    return JSON.parse(JSON.stringify(fileCache[filename]));
  }

  const filePath = path.join(config.dataPath, filename);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    fileCache[filename] = data;
    return JSON.parse(JSON.stringify(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      fileCache[filename] = [];
      return [];
    }
    throw err;
  }
}

async function processWriteQueue(filename) {
  if (!writeQueue[filename].length) {
    fileLocks[filename] = false;
    return;
  }
  if (fileLocks[filename]) {
    setTimeout(() => processWriteQueue(filename), 50);
    return;
  }
  fileLocks[filename] = true;
  try {
    const dataToWrite = writeQueue[filename].pop();
    writeQueue[filename] = [];
    fileCache[filename] = dataToWrite;

    const filePath = path.join(config.dataPath, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(dataToWrite, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
  } finally {
    fileLocks[filename] = false;
  }
}

async function writeJSONFile(filename, data) {
  initializeCache(filename);
  writeQueue[filename].push(data);
  fileCache[filename] = data;
  if (batchTimers[filename]) clearTimeout(batchTimers[filename]);
  batchTimers[filename] = setTimeout(() => processWriteQueue(filename), BATCH_INTERVAL);
  return Promise.resolve();
}

async function forceWriteJSONFile(filename) {
  if (!fileCache[filename]) return;
  if (batchTimers[filename]) clearTimeout(batchTimers[filename]);
  fileLocks[filename] = true;
  try {
    const filePath = path.join(config.dataPath, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(fileCache[filename], null, 2), 'utf8');
    writeQueue[filename] = [];
  } catch (err) {
    console.error(`Error force-writing ${filename}:`, err);
    throw err;
  } finally {
    fileLocks[filename] = false;
  }
}

function invalidateCache(filename) {
  fileCache[filename] = null;
}

async function flushAllWrites() {
  Object.values(batchTimers).forEach(timer => timer && clearTimeout(timer));
  const pending = Object.keys(writeQueue)
    .filter(f => writeQueue[f].length)
    .map(f => forceWriteJSONFile(f));
  return Promise.all(pending);
}

module.exports = {
  readJSONFile,
  writeJSONFile,
  forceWriteJSONFile,
  invalidateCache,
  flushAllWrites
};
