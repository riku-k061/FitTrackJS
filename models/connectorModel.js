// models/connectorModel.js
const { v4: uuidv4 } = require('uuid');
const validation = require('../utils/validation');

class Connector {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.platform = data.platform;
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.expiresAt = data.expiresAt || null;
    this.lastSync = data.lastSync || new Date().toISOString();
    this.refreshError = data.refreshError || null;
    this.refreshErrorAt = data.refreshErrorAt || null;
    this.lastSyncSuccess = data.lastSyncSuccess || null;
    this.lastSyncError = data.lastSyncError || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  static validate(data) {
    const errors = [];
    if (!validation.isValidString(data.userId)) {
      errors.push('Valid userId is required');
    }
    if (!validation.isValidString(data.platform)) {
      errors.push('Valid platform is required');
    }
    if (!validation.isValidString(data.accessToken)) {
      errors.push('Valid accessToken is required');
    }
    return errors;
  }
}

module.exports = Connector;
