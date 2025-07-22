// services/stravaService.js
const axios = require('axios');
const connectorController = require('../controllers/connectorController');
const oauthService = require('./oauthService');
const fileUtils = require('../utils/fileUtils');
const transactionUtils = require('../utils/transactionUtils');
const auditLogUtils = require('../utils/auditLogUtils');
const lockService = require('../utils/lockService');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const WORKOUTS_PATH = './data/workouts.json';

class StravaService {
  static transformActivity(act, userId) {
    const map = { Run:'running', Ride:'cycling', Swim:'swimming', Walk:'walking',
      Hike:'hiking', WeightTraining:'strength', Workout:'strength', Yoga:'yoga' };
    return {
      id: uuidv4(),
      userId,
      externalId: `strava-${act.id}`,
      date: act.start_date,
      type: map[act.type]||'other',
      duration: Math.round(act.elapsed_time/60),
      distance: act.distance ? Math.round(act.distance/10)/100 : null,
      caloriesBurned: act.calories||Math.round(act.elapsed_time/60*7),
      notes: act.name||'',
      avgHeartRate: act.average_heartrate||null,
      source: 'strava',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  static async fetchActivities(conn) {
    if (oauthService.isTokenExpired(conn)) {
      conn = await oauthService.refreshTokenWithTransaction(conn.id);
    }
    const after = Math.floor(new Date(conn.lastSync).getTime()/1000);
    try {
      const res = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
        headers: { Authorization:`Bearer ${conn.accessToken}` },
        params: { after, per_page:100 }
      });
      return res.data;
    } catch (err) {
      const status = err.response?.status;
      if (status===401||status===403) {
        conn = await oauthService.refreshTokenWithTransaction(conn.id);
        const after2 = Math.floor(new Date(conn.lastSync).getTime()/1000);
        const retry = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
          headers:{ Authorization:`Bearer ${conn.accessToken}` }, params:{ after:after2, per_page:100 }
        });
        return retry.data;
      }
      if (status===429) {
        const retryAfter = err.response.headers['retry-after']||1800;
        throw new Error(`Rate limited by Strava. Retry after ${retryAfter}s`);
      }
      throw err;
    }
  }

  static async syncConnector(connector) {
    const lockHolder = `strava-sync-${connector.userId}`;
    return await lockService.withResourceLock('connector', connector.id, async () => {
      return await transactionUtils.executeTransaction(async () => {
        connector = await connectorController.getById(connector.id);
        const acts = await this.fetchActivities(connector);
        if (!acts.length) {
          await connectorController.update(connector.id, { lastSync:new Date().toISOString() });
          return { added:0, updated:0 };
        }
        const workouts = acts.map(a=>this.transformActivity(a, connector.userId));
        const current = await fileUtils.readJSONFile(WORKOUTS_PATH);
        let stats={added:0,updated:0};
        for (const w of workouts) {
          const idx = current.findIndex(x=>x.externalId===w.externalId);
          if (idx>=0) {
            current[idx]={ ...current[idx], ...w, id:current[idx].id, updatedAt:new Date().toISOString() };
            stats.updated++;
          } else {
            current.push(w);
            stats.added++;
          }
        }
        await fileUtils.writeJSONFile(WORKOUTS_PATH, current);
        await connectorController.update(connector.id, {
          lastSync: new Date().toISOString(),
          lastSyncSuccess:true,
          lastSyncError:null
        });
        await auditLogUtils.logActivity({
          type: 'strava-sync',
          userId: connector.userId,
          details: `Synced ${stats.added} new and updated ${stats.updated} workouts`,
          timestamp: new Date().toISOString()
        });
        return { success:true, added:stats.added, updated:stats.updated };
      });
    }, lockHolder, 60000);
  }

  static async syncAllStravaConnectors() {
    const all = await connectorController.getAll();
    const stravas = all.filter(c=>c.platform==='strava');
    const results = [];
    for (const c of stravas) {
      try {
        results.push({ userId:c.userId, ...(await this.syncConnector(c)) });
      } catch (err) {
        results.push({ userId:c.userId, success:false, message:err.message });
      }
    }
    return results;
  }
}

module.exports = StravaService;
