const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSONFile, writeJSONFile } = require('../utils/fileService');

const SOCIAL_SHARES_FILE = path.join(__dirname, '../data/socialShares.json');
const SUPPORTED_PLATFORMS = ['twitter', 'facebook', 'instagram', 'linkedin'];
const MAX_CONTENT_LENGTH = 280;

// Initialize file if needed
if (!fs.existsSync(SOCIAL_SHARES_FILE)) {
  writeJSONFile(SOCIAL_SHARES_FILE, []);
}

class SocialShare {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.content = data.content;
    this.platform = data.platform;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.scheduledAt = data.scheduledAt || null;
    this.status = data.status || 'draft';            // 'draft' | 'scheduled' | 'published' | 'failed'
    this.publishedAt = data.publishedAt || null;
    this.platformPostId = data.platformPostId || null;
  }

  static get validationRules() {
    return {
      content: {
        type: 'string', required: true, maxLength: MAX_CONTENT_LENGTH,
        errorMessage: `Content must be a string with maximum ${MAX_CONTENT_LENGTH} characters`
      },
      platform: {
        type: 'string', required: true, enum: SUPPORTED_PLATFORMS,
        errorMessage: `Platform must be one of: ${SUPPORTED_PLATFORMS.join(', ')}`
      },
      scheduledAt: {
        type: 'string', format: 'date-time', required: false,
        errorMessage: 'scheduledAt must be a valid ISO date-time string'
      },
      status: {
        type: 'string', enum: ['draft','scheduled','published','failed'], required: false,
        errorMessage: 'Status must be one of: draft, scheduled, published, failed'
      }
    };
  }

  static get supportedPlatforms() {
    return SUPPORTED_PLATFORMS;
  }

  static async findAll(userId = null) {
    const shares = await readJSONFile(SOCIAL_SHARES_FILE);
    return userId ? shares.filter(s => s.userId === userId) : shares;
  }

  static async findById(id) {
    const shares = await readJSONFile(SOCIAL_SHARES_FILE);
    return shares.find(s => s.id === id) || null;
  }

  static async findByUserId(userId) {
    return this.findAll(userId);
  }

  static async deleteById(id) {
    const shares = await readJSONFile(SOCIAL_SHARES_FILE);
    const filtered = shares.filter(s => s.id !== id);
    if (filtered.length !== shares.length) {
      await writeJSONFile(SOCIAL_SHARES_FILE, filtered);
      return true;
    }
    return false;
  }

  async save() {
    const shares = await readJSONFile(SOCIAL_SHARES_FILE);
    const idx = shares.findIndex(s => s.id === this.id);
    if (idx !== -1) shares[idx] = this;
    else shares.push(this);
    await writeJSONFile(SOCIAL_SHARES_FILE, shares);
    return this;
  }
}

module.exports = SocialShare;
