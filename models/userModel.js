const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { readJSONFile, writeJSONFile } = require('../utils/fileUtils');
const config = require('../config/config');
const { backupFile, restoreFromBackup } = require('../utils/transactionUtils');

const USERS_FILE = 'users.json';
const ROLES = { USER: 'user', COACH: 'coach', ADMIN: 'admin' };

class User {
  static async create(userData) {
    const users = await readJSONFile(USERS_FILE);
    if (users.find(u => u.email === userData.email.toLowerCase().trim())) {
      const err = new Error('Email already in use'); err.statusCode = 400; throw err;
    }
    const hashed = await bcrypt.hash(userData.password, config.saltRounds);
    const newUser = {
      id: uuidv4(),
      name: userData.name.trim(),
      email: userData.email.toLowerCase().trim(),
      password: hashed,
      height: userData.height != null ? Number(userData.height) : null,
      weight: userData.weight != null ? Number(userData.weight) : null,
      fitnessGoals: Array.isArray(userData.fitnessGoals) ? userData.fitnessGoals : [],
      role: Object.values(ROLES).includes(userData.role) ? userData.role : ROLES.USER,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(newUser);
    await writeJSONFile(USERS_FILE, users);
    const { password, ...safe } = newUser;
    return safe;
  }

  static async findAll() {
    const users = await readJSONFile(USERS_FILE);
    return users.map(({ password, ...u }) => u);
  }

  static async findById(id) {
    const users = await readJSONFile(USERS_FILE);
    const u = users.find(u => u.id === id);
    return u ? (({ password, ...o }) => o)(u) : null;
  }

  static async update(id, data) {
    const users = await readJSONFile(USERS_FILE);
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;

    const current = users[idx];
    const updated = { ...current, ...data, updatedAt: new Date().toISOString() };

    if (data.password) {
      updated.password = await bcrypt.hash(data.password, config.saltRounds);
    }
    if (data.name != null) updated.name = data.name.trim();
    if (data.email != null) updated.email = data.email.toLowerCase().trim();
    if (data.height != null) updated.height = Number(data.height);
    if (data.weight != null) updated.weight = Number(data.weight);
    if (data.fitnessGoals != null) updated.fitnessGoals = Array.isArray(data.fitnessGoals)
      ? data.fitnessGoals
      : current.fitnessGoals;

    users[idx] = updated;
    await writeJSONFile(USERS_FILE, users);

    const { password, ...safe } = updated;
    return safe;
  }

  static async delete(id) {
    const users = await readJSONFile(USERS_FILE);
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return false;
    users.splice(idx, 1);
    await writeJSONFile(USERS_FILE, users);
    return true;
  }

  static async verifyCredentials(email, password) {
    const users = await readJSONFile(USERS_FILE);
    const user = users.find(u => u.email === email.toLowerCase().trim());
    if (!user) return null;
    const match = await bcrypt.compare(password, user.password);
    if (!match) return null;
    const { password: _, ...safe } = user;
    return safe;
  }

  static async prepareUpdate(id, updateData) {
    const users = await readJSONFile(USERS_FILE);
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;

    const oldUser = { ...users[idx] };
    const newUser = { ...oldUser, ...updateData, updatedAt: new Date().toISOString() };
    
    // handle trimming, hashing, conversions as before...
    
    return {
        oldUser,
        updatedUser: { ...newUser },
        execute: async () => {
        users[idx] = newUser;
        await writeJSONFile(USERS_FILE, users);
        const { password, ...safe } = newUser;
        return safe;
        },
        rollback: async () => { /* no-op */ }
    };
  }

  static async prepareDelete(id) {
    const users = await readJSONFile(USERS_FILE);
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;

    const toDelete = { ...users[idx] };
    await backupFile(USERS_FILE);

    return {
        user: toDelete,
        execute: async () => {
        users.splice(idx, 1);
        await writeJSONFile(USERS_FILE, users);
        return { success: true, userId: id };
        },
        rollback: async () => restoreFromBackup(USERS_FILE)
    };
  }
}

module.exports = { User, ROLES };