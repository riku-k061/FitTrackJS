const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config/config');
const { readJSONFile, writeJSONFile } = require('../utils/fileUtils');
const { createWorkout } = require('../models/workoutModel');

// File paths based on environment - use simple filenames, let fileUtils handle the path
const CONNECTORS_FILE = 'connectors.json';
const WORKOUTS_FILE = 'workouts.json';

// Note: Using standard fileUtils functions for consistency

// Strava API configuration
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || 'test_client_id';
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || 'test_client_secret';
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI || 'http://localhost:3000/connectors/strava/callback';

/**
 * Initiate Strava OAuth flow
 */
async function initiateAuth(req, res) {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId required' });
    }

    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&approval_prompt=force&scope=read,activity:read_all&state=${state}`;
    
    res.redirect(authUrl);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Handle OAuth callback and create connector
 */
async function handleCallback(req, res) {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).json({ success: false, message: 'Invalid callback parameters' });
    }

    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code for token
    const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token, expires_at } = tokenResponse.data;

    // Create connector record
    const connector = {
      id: uuidv4(),
      userId,
      provider: 'strava',
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: expires_at * 1000, // Convert to milliseconds
      createdAt: Date.now(),
      lastSync: null,
      status: 'connected'
    };

    // Save connector
    const connectors = await readJSONFile(CONNECTORS_FILE);
    connectors.push(connector);
    await writeJSONFile(CONNECTORS_FILE, connectors);

    res.json({ success: true, connector });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Test connection to Strava
 */
async function testConnection(req, res) {
  try {
    const { id } = req.params;
    const connectors = await readJSONFile(CONNECTORS_FILE);
    const connector = connectors.find(c => c.id === id);

    if (!connector) {
      return res.status(404).json({ success: false, message: 'Connector not found' });
    }

    // Helper function to convert expiresAt to timestamp
    const getExpiryTimestamp = (expiresAt) => {
      if (typeof expiresAt === 'number') {
        return expiresAt;
      }
      if (typeof expiresAt === 'string') {
        return new Date(expiresAt).getTime();
      }
      return 0;
    };

    // Check if token needs refresh
    let wasRefreshed = false;
    const expiryTimestamp = getExpiryTimestamp(connector.expiresAt);
    if (Date.now() >= expiryTimestamp) {
      try {
        await refreshAccessToken(connector);
        // Update connector in file
        const index = connectors.findIndex(c => c.id === id);
        connectors[index] = connector;
        await writeJSONFile(CONNECTORS_FILE, connectors);
        wasRefreshed = true;
      } catch (refreshError) {
        return res.json({ success: false, status: 'refresh_failed', message: refreshError.message });
      }
    }

    // Test API call
    try {
      await axios.get('https://www.strava.com/api/v3/athlete', {
        headers: { Authorization: `Bearer ${connector.accessToken}` }
      });
      res.json({ 
        success: true, 
        status: wasRefreshed ? 'token_refreshed' : 'connected'
      });
    } catch (apiError) {
      if (apiError.response?.status === 401) {
        // If we get 401 and haven't attempted refresh yet, try to refresh
        if (!wasRefreshed) {
          try {
            await refreshAccessToken(connector);
            // Update connector in file
            const index = connectors.findIndex(c => c.id === id);
            connectors[index] = connector;
            await writeJSONFile(CONNECTORS_FILE, connectors);
            
            // Retry the API call with new token
            await axios.get('https://www.strava.com/api/v3/athlete', {
              headers: { Authorization: `Bearer ${connector.accessToken}` }
            });
            
            return res.json({ 
              success: true, 
              status: 'token_refreshed'
            });
          } catch (refreshError) {
            return res.json({ success: false, status: 'refresh_failed', message: refreshError.message });
          }
        }
        res.json({ success: false, status: 'unauthorized' });
      } else {
        throw apiError;
      }
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Initial sync - fetch all activities
 */
async function initialSync(req, res) {
  try {
    const { id } = req.params;
    const result = await performSync(id, 'initial');
    res.json(result);
  } catch (error) {
    if (error.message.includes('Rate limit')) {
      res.status(429).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

/**
 * Incremental sync - fetch recent activities
 */
async function incrementalSync(req, res) {
  try {
    const { id } = req.params;
    const result = await performSync(id, 'incremental');
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * System-wide sync for all connectors
 */
async function syncAll(req, res) {
  try {
    const connectors = await readJSONFile(CONNECTORS_FILE);
    const stravaConnectors = connectors.filter(c => c.provider === 'strava');

    let totalAdded = 0;
    let totalUpdated = 0;

    for (const connector of stravaConnectors) {
      try {
        const result = await performSync(connector.id, 'incremental');
        totalAdded += result.added || 0;
        totalUpdated += result.updated || 0;
      } catch (error) {
        console.error(`Sync failed for connector ${connector.id}:`, error.message);
      }
    }

    res.json({ success: true, totalAdded, totalUpdated, processedConnectors: stravaConnectors.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Perform sync operation
 */
async function performSync(connectorId, syncType) {
  const connectors = await readJSONFile(CONNECTORS_FILE);
  const connector = connectors.find(c => c.id === connectorId);

  if (!connector) {
    throw new Error('Connector not found');
  }

  // Helper function to convert expiresAt to timestamp
  const getExpiryTimestamp = (expiresAt) => {
    if (typeof expiresAt === 'number') {
      return expiresAt;
    }
    if (typeof expiresAt === 'string') {
      return new Date(expiresAt).getTime();
    }
    return 0;
  };

  // Check token expiry and refresh if needed
  const expiryTimestamp = getExpiryTimestamp(connector.expiresAt);
  if (Date.now() >= expiryTimestamp) {
    await refreshAccessToken(connector);
    const index = connectors.findIndex(c => c.id === connectorId);
    connectors[index] = connector;
    await writeJSONFile(CONNECTORS_FILE, connectors);
  }

  let activities;
  try {
    // Fetch activities from Strava
    const params = {};
    if (syncType === 'incremental' && connector.lastSync) {
      params.after = Math.floor(connector.lastSync / 1000);
    }

    const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { Authorization: `Bearer ${connector.accessToken}` },
      params
    });
    activities = response.data;
  } catch (apiError) {
    if (apiError.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    throw new Error(`Strava API error: ${apiError.message}`);
  }

  // Process activities
  const workouts = await readJSONFile(WORKOUTS_FILE);
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const activity of activities) {
    try {
      // Skip invalid activities (for testing)
      if (!activity.type || (!activity.moving_time && !activity.elapsed_time)) {
        skipped++;
        continue;
      }

      const existingIndex = workouts.findIndex(w => w.externalId === `strava-${activity.id}`);
      
      const workoutData = {
        id: existingIndex >= 0 ? workouts[existingIndex].id : uuidv4(),
        userId: connector.userId,
        externalId: `strava-${activity.id}`,
        externalProvider: 'strava',
        date: activity.start_date,
        exerciseType: mapStravaActivityType(activity.type),
        duration: Math.round((activity.moving_time || activity.elapsed_time) / 60), // Convert seconds to minutes
        caloriesBurned: activity.calories || 0,
        reps: 0,
        sets: 0,
        notes: activity.name || '',
        createdAt: existingIndex >= 0 ? workouts[existingIndex].createdAt : Date.now(),
        updatedAt: Date.now()
      };

      if (existingIndex >= 0) {
        workouts[existingIndex] = workoutData;
        updated++;
      } else {
        workouts.push(workoutData);
        added++;
      }
    } catch (error) {
      console.error(`Error processing activity ${activity.id}:`, error);
      skipped++;
    }
  }

  // Save updated workouts
  await writeJSONFile(WORKOUTS_FILE, workouts);

  // Update connector last sync time
  connector.lastSync = Date.now();
  const connectorIndex = connectors.findIndex(c => c.id === connectorId);
  connectors[connectorIndex] = connector;
  await writeJSONFile(CONNECTORS_FILE, connectors);

  return { success: true, added, updated, skipped };
}

/**
 * Refresh access token
 */
async function refreshAccessToken(connector) {
  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: connector.refreshToken,
      grant_type: 'refresh_token'
    });

    connector.accessToken = response.data.access_token;
    connector.refreshToken = response.data.refresh_token;
    connector.expiresAt = response.data.expires_at * 1000;
  } catch (error) {
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}

/**
 * Map Strava activity types to our exercise types
 */
function mapStravaActivityType(stravaType) {
  const typeMap = {
    'Run': 'cardio',
    'Ride': 'cardio',
    'Swim': 'cardio',
    'WeightTraining': 'strength',
    'Workout': 'strength',
    'Yoga': 'flexibility'
  };
  return typeMap[stravaType] || 'cardio';
}

module.exports = {
  initiateAuth,
  handleCallback,
  testConnection,
  initialSync,
  incrementalSync,
  syncAll
};