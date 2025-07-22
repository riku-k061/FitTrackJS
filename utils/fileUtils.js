const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

// Helper function to get the full path to a data file
function getDataFilePath(filename) {
  return path.join(config.dataPath || 'data', filename);
}

// In-memory cache, write queue, locks and timers
const fileCache = new Map();
const writeQueue = {};
const fileLocks = {};
const batchTimers = {};
const BATCH_INTERVAL = 100;

// Additional variables for the second cache system
const writeQueues = new Map();
const queueStatus = new Map();
const updateCallbacks = new Map();
const DEFAULT_BATCH_WINDOW = 100;

function initializeCache(filename) {
  if (!(filename in writeQueue)) writeQueue[filename] = [];
  if (!(filename in fileLocks)) fileLocks[filename] = false;
}

async function readJSONFile(filename) {
  initializeCache(filename);
  if (fileCache.has(filename)) {
    return JSON.parse(JSON.stringify(fileCache.get(filename)));
  }

  // If filename is absolute, use it directly, otherwise join with dataPath
  const filePath = path.isAbsolute(filename) ? filename : path.join(config.dataPath, filename);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    fileCache.set(filename, data);
    return JSON.parse(JSON.stringify(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      fileCache.set(filename, []);
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
    fileCache.set(filename, dataToWrite);

    // Handle absolute paths correctly
    const filePath = path.isAbsolute(filename) ? filename : path.join(config.dataPath, filename);
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
  fileCache.set(filename, data);
  if (batchTimers[filename]) clearTimeout(batchTimers[filename]);
  batchTimers[filename] = setTimeout(() => processWriteQueue(filename), BATCH_INTERVAL);
  return Promise.resolve();
}

async function forceWriteJSONFile(filename) {
  if (!fileCache.has(filename)) return;
  if (batchTimers[filename]) clearTimeout(batchTimers[filename]);
  fileLocks[filename] = true;
  try {
    const filePath = path.join(config.dataPath, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(fileCache.get(filename), null, 2), 'utf8');
    writeQueue[filename] = [];
  } catch (err) {
    console.error(`Error force-writing ${filename}:`, err);
    throw err;
  } finally {
    fileLocks[filename] = false;
  }
}

function invalidateCache(filename) {
  fileCache.delete(filename);
}

async function flushAllWrites() {
  Object.values(batchTimers).forEach(timer => timer && clearTimeout(timer));
  const pending = Object.keys(writeQueue)
    .filter(f => writeQueue[f].length)
    .map(f => forceWriteJSONFile(f));
  return Promise.all(pending);
}

async function ensureDataDir() {
  const dir = path.join(process.cwd(), 'data');
  try { await fs.access(dir); }
  catch { await fs.mkdir(dir, { recursive: true }); }
}

// Read with cache
async function readDataFile(relPath) {
  const full = path.join(process.cwd(), relPath);
  if (fileCache.has(relPath)) {
    return structuredClone(fileCache.get(relPath));
  }
  await ensureDataDir();
  try {
    const txt = await fs.readFile(full, 'utf8');
    const obj = JSON.parse(txt);
    fileCache.set(relPath, obj);
    return structuredClone(obj);
  } catch (err) {
    if (err.code === 'ENOENT' || err instanceof SyntaxError) {
      const init = [];
      await fs.writeFile(full, JSON.stringify(init, null, 2));
      fileCache.set(relPath, init);
      return [...init];
    }
    throw err;
  }
}

// Write with batching
async function writeDataFile(relPath, data, batchWindow = DEFAULT_BATCH_WINDOW) {
  const full = path.join(process.cwd(), relPath);
  fileCache.set(relPath, structuredClone(data));
  notifyUpdate(relPath);

  if (!writeQueues.has(relPath)) writeQueues.set(relPath, []);
  return new Promise((res, rej) => {
    writeQueues.get(relPath).push({ data, res, rej });
    if (!queueStatus.get(relPath)) processQueue(relPath, full, batchWindow);
  });
}

async function processQueue(relPath, full, batchWindow) {
  queueStatus.set(relPath, true);
  await new Promise(r => setTimeout(r, batchWindow));
  const queue = writeQueues.get(relPath);
  const { data } = queue[queue.length - 1];
  try {
    await ensureDataDir();
    await fs.writeFile(full, JSON.stringify(data, null, 2));
    queue.forEach(({ res }) => res(data));
  } catch (e) {
    queue.forEach(({ rej }) => rej(e));
  } finally {
    writeQueues.set(relPath, []);
    queueStatus.set(relPath, false);
    if (writeQueues.get(relPath).length) {
      processQueue(relPath, full, batchWindow);
    }
  }
}

// Event subscription
function onUpdate(relPath, cb) {
  if (!updateCallbacks.has(relPath)) updateCallbacks.set(relPath, new Set());
  updateCallbacks.get(relPath).add(cb);
}
function offUpdate(relPath, cb) {
  updateCallbacks.get(relPath)?.delete(cb);
}
function notifyUpdate(relPath) {
  updateCallbacks.get(relPath)?.forEach(cb => {
    try { cb(relPath); } catch (e) { console.error(e); }
  });
}
module.exports = {
  readJSONFile,
  writeJSONFile,
  forceWriteJSONFile,
  invalidateCache,
  flushAllWrites,
  readDataFile,
  writeDataFile,
  getDataFilePath,
  fileCache,
  onUpdate,
  offUpdate
};
