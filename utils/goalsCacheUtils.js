// utils/goalsCacheUtils.js
const fs = require('fs');
const path = require('path');
const { readJSONFile, writeJSONFile } = require('./fileUtils');

const GOALS_FILE = path.join(__dirname, '../data/fitnessGoals.json');
const WRITE_INTERVAL = 1000; // milliseconds

class GoalsCacheManager {
  constructor() {
    this.cache = null;
    this.isLoaded = false;
    this.isDirty = false;
    this.writeLock = false;
    this.lastWriteTime = 0;
    this.writePromises = [];

    this.userIdIndex = new Map();
    this.goalTypeIndex = new Map();

    if (!fs.existsSync(GOALS_FILE)) {
      writeJSONFile(GOALS_FILE, []);
    }

    setInterval(() => this._processBatchWrite(), WRITE_INTERVAL);
  }

  async _loadCache() {
    if (!this.isLoaded) {
      this.cache = await readJSONFile(GOALS_FILE);
      this._buildIndices();
      this.isLoaded = true;
    }
  }

  _buildIndices() {
    this.userIdIndex.clear();
    this.goalTypeIndex.clear();
    this.cache.forEach((g, i) => {
      (this.userIdIndex.get(g.userId) || (this.userIdIndex.set(g.userId, []), this.userIdIndex.get(g.userId))).push(i);
      (this.goalTypeIndex.get(g.goalType) || (this.goalTypeIndex.set(g.goalType, []), this.goalTypeIndex.get(g.goalType))).push(i);
    });
  }

  _queueWrite() {
    return new Promise(resolve => {
      this.writePromises.push(resolve);
      if (!this.writeLock && Date.now() - this.lastWriteTime > WRITE_INTERVAL) {
        this._processBatchWrite();
      }
    });
  }

  async _processBatchWrite() {
    if (!this.isDirty || this.writeLock || !this.writePromises.length) return;
    this.writeLock = true;
    const resolvers = this.writePromises.splice(0);
    try {
      await writeJSONFile(GOALS_FILE, this.cache);
      this.isDirty = false;
      this.lastWriteTime = Date.now();
      resolvers.forEach(r => r());
    } catch (e) {
      console.error('Batch write failed', e);
      // on failure, re‑queue resolvers
      this.writePromises.unshift(...resolvers);
    } finally {
      this.writeLock = false;
    }
  }

  async getAll() {
    await this._loadCache();
    return [...this.cache];
  }

  async getById(id) {
    await this._loadCache();
    return this.cache.find(g => g.id === id) || null;
  }

  async filter({ userId, goalType, status, limit = 10, offset = 0 }) {
    await this._loadCache();
    let indices = null;

    if (userId && this.userIdIndex.has(userId)) {
      indices = new Set(this.userIdIndex.get(userId));
    }
    if (goalType && this.goalTypeIndex.has(goalType)) {
      const gs = this.goalTypeIndex.get(goalType);
      indices = indices
        ? new Set([...indices].filter(i => gs.includes(i)))
        : new Set(gs);
    }

    let items = indices
      ? [...indices].map(i => this.cache[i])
      : [...this.cache];

    if (status === 'active' || status === 'inactive') {
      const now = new Date();
      items = items.filter(g => {
        const s = new Date(g.startDate), e = new Date(g.endDate);
        const active = s <= now && now <= e;
        return status === 'active' ? active : !active;
      });
    }

    const totalCount = items.length;
    const paged = items.slice(offset, offset + limit);
    return {
      goals: paged,
      pagination: {
        totalCount,
        limit: +limit,
        offset: +offset,
        hasMore: offset + paged.length < totalCount
      }
    };
  }

  async add(goal) {
    await this._loadCache();
    const idx = this.cache.length;
    this.cache.push(goal);
    (this.userIdIndex.get(goal.userId) || (this.userIdIndex.set(goal.userId, []), this.userIdIndex.get(goal.userId))).push(idx);
    (this.goalTypeIndex.get(goal.goalType) || (this.goalTypeIndex.set(goal.goalType, []), this.goalTypeIndex.get(goal.goalType))).push(idx);
    this.isDirty = true;
    await this._queueWrite();
  }

  async update(id, updated) {
    await this._loadCache();
    const idx = this.cache.findIndex(g => g.id === id);
    if (idx === -1) return null;
    const old = this.cache[idx];
    // remove old indices
    this.userIdIndex.set(old.userId, this.userIdIndex.get(old.userId).filter(i => i !== idx));
    this.goalTypeIndex.set(old.goalType, this.goalTypeIndex.get(old.goalType).filter(i => i !== idx));
    // apply update
    this.cache[idx] = updated;
    // re‑index
    (this.userIdIndex.get(updated.userId) || (this.userIdIndex.set(updated.userId, []), this.userIdIndex.get(updated.userId))).push(idx);
    (this.goalTypeIndex.get(updated.goalType) || (this.goalTypeIndex.set(updated.goalType, []), this.goalTypeIndex.get(updated.goalType))).push(idx);
    this.isDirty = true;
    await this._queueWrite();
    return updated;
  }

  async remove(id) {
    await this._loadCache();
    const idx = this.cache.findIndex(g => g.id === id);
    if (idx === -1) return false;
    const old = this.cache.splice(idx, 1)[0];
    this._buildIndices();
    this.isDirty = true;
    await this._queueWrite();
    return true;
  }
}

module.exports = new GoalsCacheManager();
