// services/oauthService.js
const axios = require('axios');
const connectorController = require('../controllers/connectorController');
const transactionUtils = require('../utils/transactionUtils');
const lockService = require('../utils/lockService');
require('dotenv').config();

const oauthConfigs = {
  strava: {
    authUrl: 'https://www.strava.com/oauth/authorize',
    tokenUrl: 'https://www.strava.com/oauth/token',
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
    scope: 'activity:read_all,profile:read_all',
    redirectUri: process.env.APP_URL + '/connectors/strava/callback'
  }
};

class OAuthService {
  static getAuthorizationUrl(platform, userId) {
    const cfg = oauthConfigs[platform];
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    return `${cfg.authUrl}?client_id=${cfg.clientId}&redirect_uri=${cfg.redirectUri}&response_type=code&scope=${cfg.scope}&state=${state}`;
  }

  static isTokenExpired(conn) {
    if (conn.expiresAt) {
      return new Date(conn.expiresAt).getTime() - 5*60*1000 < Date.now();
    }
    return true;
  }

  static async refreshTokenWithTransaction(connectorId) {
    const lockHolder = `token-refresh-${connectorId}`;
    return await lockService.withResourceLock('connector', connectorId, async () => {
      return await transactionUtils.executeTransaction(async () => {
        const conn = await connectorController.getById(connectorId);
        const cfg = oauthConfigs[conn.platform];

        const resp = await axios.post(cfg.tokenUrl, {
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          refresh_token: conn.refreshToken,
          grant_type: 'refresh_token'
        });

        const expiresAt = resp.data.expires_in
          ? new Date(Date.now() + resp.data.expires_in*1000).toISOString()
          : null;

        const updated = await connectorController.update(connectorId, {
          accessToken: resp.data.access_token,
          refreshToken: resp.data.refresh_token || conn.refreshToken,
          expiresAt,
          updatedAt: new Date().toISOString()
        });

        return updated;
      });
    }, lockHolder, 30000);
  }

  static async handleCallback(platform, code, state) {
    const cfg = oauthConfigs[platform];
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
    const resp = await axios.post(cfg.tokenUrl, {
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: cfg.redirectUri
    });

    const all = await connectorController.getAll();
    const existing = all.find(c => c.userId === userId && c.platform === platform);
    const data = {
      userId,
      platform,
      accessToken: resp.data.access_token,
      refreshToken: resp.data.refresh_token,
      expiresAt: resp.data.expires_in
        ? new Date(Date.now() + resp.data.expires_in*1000).toISOString()
        : null,
      lastSync: new Date().toISOString()
    };
    return existing
      ? await connectorController.update(existing.id, data)
      : await connectorController.create(data);
  }
}

module.exports = OAuthService;
