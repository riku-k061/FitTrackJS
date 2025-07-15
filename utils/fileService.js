// utils/fileService.js
const fs = require('fs').promises;
const path = require('path');

class FileService {
  constructor() {
    this.collections = {
      nutritionLogs: {
        filePath: path.join(__dirname, '../data/nutritionLogs.json'),
        cache: null,
        writeQueue: [],
        isWriting: false,
        lastModified: null
      },
      workouts: {
        filePath: path.join(__dirname, '../data/workouts.json'),
        cache: null,
        writeQueue: [],
        isWriting: false,
        lastModified: null
      },
      users: {
        filePath: path.join(__dirname, '../data/users.json'),
        cache: null,
        writeQueue: [],
        isWriting: false,
        lastModified: null
      }
    };
    this.config = {
      batchDelayMs: 100,
      maxQueueSize: 50,
      maxDelayMs: 2000,
      enableProfiling: true,
    };
    this.metrics = { reads: {}, writes: {}, hits: {}, misses: {} };
    this.flushTimers = {};
    this.startCacheCleanup();
  }

  async initCache(collectionName) {
    const col = this.collections[collectionName];
    if (!col) throw new Error(`Collection ${collectionName} not found`);
    const stats = await fs.stat(col.filePath);
    const mtime = stats.mtime.getTime();
    if (col.cache && col.lastModified === mtime) return col.cache;
    const start = Date.now();
    const data = JSON.parse(await fs.readFile(col.filePath, 'utf8'));
    col.cache = data;
    col.lastModified = mtime;
    const dur = Date.now() - start;
    this.metrics.reads[collectionName] = this.metrics.reads[collectionName] || {count:0, totalTime:0};
    this.metrics.reads[collectionName].count++;
    this.metrics.reads[collectionName].totalTime += dur;
    return data;
  }

  async getAll(collectionName) {
    if (!this.collections[collectionName].cache) {
      this.metrics.misses[collectionName] = (this.metrics.misses[collectionName]||0)+1;
      await this.initCache(collectionName);
    } else {
      this.metrics.hits[collectionName] = (this.metrics.hits[collectionName]||0)+1;
    }
    return [...this.collections[collectionName].cache];
  }

  async getById(collectionName, id) {
    return (await this.getAll(collectionName)).find(item => item.id === id);
  }

  async create(collectionName, item) {
    const data = await this.getAll(collectionName);
    data.push(item);
    this.collections[collectionName].cache = data;
    await this.queueWrite(collectionName, data);
    return item;
  }

  async update(collectionName, id, updates) {
    const data = await this.getAll(collectionName);
    const idx = data.findIndex(i => i.id === id);
    if (idx === -1) throw new Error(`Item ${id} not found in ${collectionName}`);
    const updated = { ...data[idx], ...updates, updatedAt: new Date().toISOString() };
    data[idx] = updated;
    this.collections[collectionName].cache = data;
    await this.queueWrite(collectionName, data);
    return updated;
  }

  async delete(collectionName, id) {
    const data = await this.getAll(collectionName);
    const idx = data.findIndex(i => i.id === id);
    if (idx === -1) throw new Error(`Item ${id} not found in ${collectionName}`);
    data.splice(idx, 1);
    this.collections[collectionName].cache = data;
    await this.queueWrite(collectionName, data);
    return { success: true, message: 'Item deleted successfully' };
  }

  async queueWrite(collectionName, data) {
    const col = this.collections[collectionName];
    const p = new Promise(resolve => col.writeQueue.push({ data:[...data], resolve }));
    clearTimeout(this.flushTimers[collectionName]);
    this.flushTimers[collectionName] = setTimeout(() => this.processWriteQueue(collectionName), this.config.batchDelayMs);
    if (col.writeQueue.length >= this.config.maxQueueSize) this.processWriteQueue(collectionName);
    return p;
  }

  async processWriteQueue(collectionName) {
    const col = this.collections[collectionName];
    if (!col.writeQueue.length || col.isWriting) return;
    col.isWriting = true;
    try {
      const { data } = col.writeQueue[col.writeQueue.length-1];
      const start = Date.now();
      await fs.writeFile(col.filePath, JSON.stringify(data, null,2));
      col.lastModified = Date.now();
      const dur = Date.now() - start;
      this.metrics.writes[collectionName] = this.metrics.writes[collectionName]||{count:0,totalTime:0,batchSize:[]};
      this.metrics.writes[collectionName].count++;
      this.metrics.writes[collectionName].totalTime += dur;
      this.metrics.writes[collectionName].batchSize.push(col.writeQueue.length);
      col.writeQueue.forEach(({ resolve }) => resolve());
      col.writeQueue = [];
    } catch (err) {
      console.error(`WriteQueue ${collectionName} error:`, err);
      col.writeQueue.forEach(({ resolve }) => resolve(err));
      col.writeQueue = [];
    } finally {
      col.isWriting = false;
    }
  }

  async flushAll() {
    await Promise.all(Object.keys(this.collections).map(c => this.processWriteQueue(c)));
  }

  getMetrics() {
    const out = { reads: {}, writes: {}, cacheEfficiency: {} };
    for (const c in this.metrics.reads) {
      const r = this.metrics.reads[c];
      out.reads[c] = { count: r.count, avgTimeMs: r.totalTime / r.count };
    }
    for (const c in this.metrics.writes) {
      const w = this.metrics.writes[c];
      out.writes[c] = { count: w.count, avgTimeMs: w.totalTime / w.count, avgBatchSize: w.batchSize.reduce((a,b)=>a+b,0)/w.batchSize.length };
    }
    for (const c in this.collections) {
      const h = this.metrics.hits[c]||0, m = this.metrics.misses[c]||0;
      const t = h+m;
      out.cacheEfficiency[c] = { hits: h, misses: m, hitRate: t? h/t : 0 };
    }
    return out;
  }

  resetMetrics() { this.metrics = { reads:{}, writes:{}, hits:{}, misses:{} }; }

  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const c in this.collections) {
        const col = this.collections[c];
        if (col.lastModified && now - col.lastModified > 3600000) col.cache = null;
      }
    }, 3600000);
  }
}

module.exports = new FileService();
