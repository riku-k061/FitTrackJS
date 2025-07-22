// utils/userService.js
const fs = require('fs');
const path = require('path');
const { readJSONFile } = require('./fileUtils');

const USERS_FILE = path.join(__dirname, '../data/users.json');

class UserService {
  constructor() {
    this.users = null;
    this.map = new Map();
    this.loadedAt = 0;
    this.ttl = 60_000; // 1 minute
  }

  async _load() {
    const now = Date.now();
    if (!this.users || now - this.loadedAt > this.ttl) {
      if (!fs.existsSync(USERS_FILE)) throw new Error('Users file missing');
      this.users = await readJSONFile(USERS_FILE);
      this.map.clear();
      this.users.forEach(u => this.map.set(u.id, u));
      this.loadedAt = now;
    }
  }

  async getPublic(userId) {
    await this._load();
    const u = this.map.get(userId);
    if (!u) return null;
    return { id: u.id, name: u.name, email: u.email };
  }

  async exists(userId) {
    await this._load();
    return this.map.has(userId);
  }
}

module.exports = new UserService();
