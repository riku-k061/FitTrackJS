// tests/integration/stravaConnectorE2E.test.js
const request = require('supertest');
const nock = require('nock');
const path = require('path');
const fs = require('fs').promises;
const app = require('../../app');
const { v4: uuidv4 } = require('uuid');
const fileUtils = require('../../utils/fileUtils');

// Helper to get a timestamp offset by minutes
const getTimestamp = (offsetMinutes = 0) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + offsetMinutes);
  return date.toISOString();
};

// Test data paths
const TEST_DATA_DIR = path.join(__dirname, '../data');
const CONNECTORS_PATH = path.join(TEST_DATA_DIR, 'connectors.json');
const WORKOUTS_PATH   = path.join(TEST_DATA_DIR, 'workouts.json');

// File paths based on environment - use simple filenames, let fileUtils handle the path
const CONNECTORS_FILE = 'connectors.json';
const WORKOUTS_FILE = 'workouts.json';

// Sample test user
const testUser = {
  id: uuidv4(),
  email: 'test@example.com',
  name: 'Test User'
};

// Sample Strava tokens and responses
const stravaAuthCode  = 'test_auth_code_123';
const stravaUserId    = 12345678;
const stravaTokenResponse = {
  token_type:   'Bearer',
  access_token: 'mock_access_token_' + uuidv4(),
  refresh_token:'mock_refresh_token_' + uuidv4(),
  expires_at:   Math.floor(Date.now()/1000) + 21600,
  expires_in:   21600
};
const stravaRefreshedTokenResponse = {
  token_type:   'Bearer',
  access_token: 'mock_refreshed_token_' + uuidv4(),
  refresh_token:'mock_refreshed_refresh_token_' + uuidv4(),
  expires_at:   Math.floor(Date.now()/1000) + 21600,
  expires_in:   21600
};
const stravaAthleteResponse = {
  id: stravaUserId,
  username: 'strava_test_user',
  firstname:'Test',
  lastname: 'Athlete'
};

// Generate a fake Strava activity
const generateStravaActivity = (id, minutesAgo = 60) => ({
  id,
  name: `Test Activity ${id}`,
  type: 'Run',
  start_date: getTimestamp(-minutesAgo),
  elapsed_time: 1800,
  distance: 5000,
  calories: 250,
  average_heartrate: 145
});

// Setup/teardown
beforeAll(async () => {
  // Set the config dataPath to point to test directory
  const config = require('../../config/config');
  config.dataPath = TEST_DATA_DIR;
  
  await fs.mkdir(TEST_DATA_DIR, { recursive: true });
  await fs.writeFile(CONNECTORS_PATH, '[]');
  await fs.writeFile(WORKOUTS_PATH, '[]');
  process.env.STRAVA_CLIENT_ID     = 'test_client_id';
  process.env.STRAVA_CLIENT_SECRET = 'test_client_secret';
  process.env.APP_URL              = 'http://localhost:3000';
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1');
  
  // Store original for cleanup
  global.originalDataPath = config.dataPath;
});
afterAll(async () => {
  // Restore original data path
  const config = require('../../config/config');
  config.dataPath = global.originalDataPath;
  
  await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  nock.cleanAll();
  nock.enableNetConnect();
});
beforeEach(() => nock.cleanAll());

describe('Strava Connector End-to-End Flow', () => {
  let connectorId;
  const syncLatencies = [];

  test('1. Redirects to Strava auth URL', async () => {
    const res = await request(app)
      .get('/connectors/strava/auth')
      .query({ userId: testUser.id })
      .expect(302);
    expect(res.header.location).toContain('strava.com/oauth/authorize');
  });

  test('2. OAuth callback creates connector', async () => {
    nock('https://www.strava.com')
      .post('/oauth/token')
      .reply(200, stravaTokenResponse);
    const state = Buffer.from(JSON.stringify({ userId:testUser.id })).toString('base64');
    const res = await request(app)
      .get('/connectors/strava/callback')
      .query({ code: stravaAuthCode, state })
      .expect(200);
    expect(res.body.success).toBe(true);
    connectorId = res.body.connector.id;
    
    // Use fileUtils instead of direct file operations for consistency
    const conns = await fileUtils.readJSONFile('connectors.json');
    expect(conns.length).toBeGreaterThan(0);
    expect(conns[0].id).toBe(connectorId);
  });

  test('3. Tests connection to Strava', async () => {
    nock('https://www.strava.com')
      .get('/api/v3/athlete')
      .reply(200, stravaAthleteResponse);
    const res = await request(app)
      .get(`/connectors/${connectorId}/test`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('connected');
  });

  test('4. Refreshes token on test when expired', async () => {
    const conns = await fileUtils.readJSONFile('connectors.json');
    conns[0].expiresAt = getTimestamp(-60);
    await fileUtils.writeJSONFile('connectors.json', conns);

    nock('https://www.strava.com')
      .post('/oauth/token')
      .reply(200, stravaRefreshedTokenResponse);
    nock('https://www.strava.com')
      .get('/api/v3/athlete')
      .reply(200, stravaAthleteResponse);

    const res = await request(app)
      .get(`/connectors/${connectorId}/test`)
      .expect(200);
    expect(res.body.status).toBe('token_refreshed');
    const updatedConns = await fileUtils.readJSONFile('connectors.json');
    expect(updatedConns[0].accessToken).toBe(stravaRefreshedTokenResponse.access_token);
  });

  test('5. Initial sync', async () => {
    const activities = [1001,1002,1003].map(id=>generateStravaActivity(id,120-id));
    nock('https://www.strava.com')
      .get('/api/v3/athlete/activities')
      .query(true)
      .reply(200, activities);
    const start = Date.now();
    const res = await request(app)
      .post(`/connectors/${connectorId}/sync`)
      .expect(200);
    syncLatencies.push(Date.now()-start);
    expect(res.body.added).toBe(3);
    
    const w = await fileUtils.readJSONFile('workouts.json');
    expect(w.length).toBe(3);
  });

  test('6. Incremental sync', async () => {
    const activities = [
      generateStravaActivity(1004, 30),
      generateStravaActivity(1003, 60)
    ];
    nock('https://www.strava.com')
      .get('/api/v3/athlete/activities')
      .query(true)
      .reply(200, activities);
    const start = Date.now();
    const res = await request(app)
      .patch(`/connectors/${connectorId}/sync`)
      .expect(200);
    syncLatencies.push(Date.now()-start);
    expect(res.body.added).toBe(1);
    expect(res.body.updated).toBe(1);
    
    const w = await fileUtils.readJSONFile('workouts.json');
    expect(w.length).toBe(4);
  });

  test('7. Skips invalid activities', async () => {
    const activities = [
      generateStravaActivity(1005,15),
      { id:1006, name:'Invalid' },
      generateStravaActivity(1007,5)
    ];
    nock('https://www.strava.com')
      .get('/api/v3/athlete/activities')
      .query(true)
      .reply(200, activities);
    const res = await request(app)
      .post(`/connectors/${connectorId}/sync`)
      .expect(200);
    expect(res.body.added).toBe(2);
    expect(res.body.skipped).toBe(1);
    
    const w = await fileUtils.readJSONFile('workouts.json');
    expect(w.length).toBe(6);
  });

  test('8. Handles rate limits', async () => {
    nock('https://www.strava.com')
      .get('/api/v3/athlete/activities')
      .query(true)
      .reply(429, { message:'Rate limit exceeded' }, {'Retry-After':'60'});
    const res = await request(app)
      .post(`/connectors/${connectorId}/sync`)
      .expect(429);
    expect(res.body.message).toContain('Rate limit');
  });

  test('9. System-wide sync', async () => {
    const connector2 = {
      id: uuidv4(),
      userId: uuidv4(),
      provider: 'strava',
      accessToken: 'token2',
      refreshToken: 'refresh2',
      expiresAt: getTimestamp(120),
      lastSync: getTimestamp(-120)
    };
    
    const conns = await fileUtils.readJSONFile('connectors.json');
    conns.push(connector2);
    await fileUtils.writeJSONFile('connectors.json', conns);
    
    nock('https://www.strava.com')
      .get('/api/v3/athlete/activities')
      .query(true)
      .reply(200, [generateStravaActivity(1008,2)]);
    nock('https://www.strava.com')
      .get('/api/v3/athlete/activities')
      .query(true)
      .reply(200, [generateStravaActivity(2001,3)]);
    
    await request(app)
      .post('/connectors/strava/sync-all')
      .expect(200);
    await new Promise(r=>setTimeout(r,500));
    
         const w = await fileUtils.readJSONFile('workouts.json');
     expect(w.map(x=>x.externalId)).toEqual(
       expect.arrayContaining(['strava-1008','strava-2001'])
     );
  });

  test('10. Reports sync latency', () => {
    const avg = syncLatencies.reduce((a,b)=>a+b)/syncLatencies.length;
    console.log(`Avg latency: ${avg.toFixed(2)}ms`);
    expect(avg).toBeGreaterThan(0);
  });
});

describe('Strava Connector Edge Cases', () => {
  let connectorId;
  beforeEach(async () => {
    connectorId = uuidv4();
    const conn = {
      id: connectorId,
      userId: testUser.id,
      provider: 'strava',
      accessToken: 'tkn',
      refreshToken: 'ref',
      expiresAt: getTimestamp(1),
      lastSync: getTimestamp(-60)
    };
    
    const fileUtils = require('../../utils/fileUtils');
    await fileUtils.writeJSONFile('connectors.json', [conn]);
  });

  test('Handles network errors', async () => {
    nock('https://www.strava.com')
      .get('/api/v3/athlete/activities')
      .replyWithError('Network error');
    const res = await request(app)
      .post(`/connectors/${connectorId}/sync`)
      .expect(500);
    expect(res.body.success).toBe(false);
    
    const fileUtils = require('../../utils/fileUtils');
    const conns = await fileUtils.readJSONFile('connectors.json');
    expect(conns.length).toBeGreaterThan(0);
  });

  test('Handles unrefreshable tokens', async () => {
    nock('https://www.strava.com')
      .post('/oauth/token')
      .reply(400, { error:'invalid_grant' });
    nock('https://www.strava.com')
      .get('/api/v3/athlete')
      .reply(401, { message:'Invalid token' });
    const res = await request(app)
      .get(`/connectors/${connectorId}/test`)
      .expect(200);
    expect(res.body.success).toBe(false);
    expect(res.body.status).toBe('refresh_failed');
  });

  test('Skips unexpected formats', async () => {
    nock('https://www.strava.com')
      .get('/api/v3/athlete/activities')
      .query(true)
      .reply(200, [{ foo:'bar' }, { baz:123 }]);
    const res = await request(app)
      .post(`/connectors/${connectorId}/sync`)
      .expect(200);
    expect(res.body.skipped).toBe(2);
    
    const fileUtils = require('../../utils/fileUtils');
    const conns = await fileUtils.readJSONFile('connectors.json');
    expect(conns[0].lastSync).not.toBe(getTimestamp(-60));
  });
});
