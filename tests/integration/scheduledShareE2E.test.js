// tests/integration/scheduledShareE2E.test.js
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const app = require('../../app');
const server = require('../../server'); // ensures WS server is running
const { getAuthToken } = require('../helpers/authHelper');
const processScheduledShares = require('../../scripts/processScheduledShares');

// Data file paths
const SHARES_FILE = path.join(__dirname, '../../data/socialShares.json');
const AUDIT_LOGS_FILE = path.join(__dirname, '../../data/auditLogs.json');

let authToken;
let shareId;
let wsClient;
let wsMessages = [];
let originalShares;
let originalAuditLogs;

// Helpers
const waitForWebSocketMessage = (predicate, timeout = 5000) => new Promise((resolve, reject) => {
  // immediate check
  const found = wsMessages.find(predicate);
  if (found) return resolve(found);

  const listener = data => {
    const msg = JSON.parse(data);
    if (predicate(msg)) {
      wsClient.off('message', listener);
      clearTimeout(timer);
      resolve(msg);
    }
  };
  wsClient.on('message', listener);
  const timer = setTimeout(() => {
    wsClient.off('message', listener);
    reject(new Error('WS message timeout'));
  }, timeout);
});

const takeFileSnapshot = filePath =>
  fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];

const countEntriesBy = (arr, pred) => arr.filter(pred).length;

beforeAll(async () => {
  authToken = await getAuthToken('sharetest@example.com', 'Password123!');
  originalShares = takeFileSnapshot(SHARES_FILE);
  originalAuditLogs = takeFileSnapshot(AUDIT_LOGS_FILE);

  // start WS client
  wsClient = new WebSocket('ws://localhost:3000/ws');
  await new Promise((res, rej) => {
    wsClient.on('open', () => {
      wsClient.send(JSON.stringify({ action: 'subscribe', channel: 'shares' }));
      res();
    });
    wsClient.on('error', rej);
  });
  wsClient.on('message', data => {
    try { wsMessages.push(JSON.parse(data)); }
    catch {}
  });
  await waitForWebSocketMessage(m => m.type === 'subscription' && m.channel === 'shares');
  wsMessages = [];
}, 10000);

afterAll(async () => {
  if (wsClient.readyState === WebSocket.OPEN) wsClient.close();
  if (shareId) {
    await request(app)
      .delete(`/api/shares/${shareId}`)
      .set('Authorization', `Bearer ${authToken}`);
  }
  // allow cleanup
  await new Promise(r => setTimeout(r, 500));
}, 10000);

describe('Scheduled Share End-to-End', () => {
  it.skip('creates, schedules, processes, and validates a share', async () => {
    // 1) Create scheduled share
    const future = new Date(Date.now() + 60000).toISOString();
    const createRes = await request(app)
      .post('/api/shares')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'E2E test', platform: 'twitter', scheduledAt: future });
    expect(createRes.status).toBe(201);
    shareId = createRes.body.data.share.id;
    expect(shareId).toBeTruthy();

    // file snapshots
    const afterCreateShares = takeFileSnapshot(SHARES_FILE);
    const created = afterCreateShares.find(s => s.id === shareId);
    expect(created).toBeDefined();
    expect(created.status).toBe('scheduled');

    const afterCreateLogs = takeFileSnapshot(AUDIT_LOGS_FILE);
    const newCreateLogs = countEntriesBy(
      afterCreateLogs,
      l => l.action === 'CREATE_SHARE' && l.resourceId === shareId
    ) - countEntriesBy(
      originalAuditLogs,
      l => l.action === 'CREATE_SHARE' && l.resourceId === shareId
    );
    expect(newCreateLogs).toBe(1);

    // WS broadcast create
    const createMsg = await waitForWebSocketMessage(m => m.type === 'share' && m.action === 'create' && m.data.id === shareId);
    expect(createMsg).toBeTruthy();

    // 2) Backdate the schedule
    const past = new Date(Date.now() - 60000).toISOString();
    const updateRes = await request(app)
      .put(`/api/shares/${shareId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ scheduledAt: past });
    expect(updateRes.status).toBe(200);

    const afterUpdate = takeFileSnapshot(SHARES_FILE).find(s => s.id === shareId);
    expect(afterUpdate.scheduledAt).toBe(past);

    const updateMsg = await waitForWebSocketMessage(m => m.type === 'share' && m.action === 'update' && m.data.id === shareId);
    expect(updateMsg).toBeTruthy();

    // 3) Process scheduled shares
    wsMessages = [];
    const realNow = Date.now;
    global.Date.now = () => new Date(past).getTime() + 120000;
    try { await processScheduledShares(); } finally { global.Date.now = realNow; }
    await new Promise(r => setTimeout(r, 1000));

    // 4) Verify published
    const afterProcess = takeFileSnapshot(SHARES_FILE).find(s => s.id === shareId);
    expect(afterProcess.status).toBe('published');
    expect(afterProcess.publishedAt).toBeTruthy();

    const afterProcessLogs = takeFileSnapshot(AUDIT_LOGS_FILE);
    const publishCount = countEntriesBy(
      afterProcessLogs,
      l => (l.action === 'PUBLISH_SHARE') && l.resourceId === shareId
    ) - countEntriesBy(
      originalAuditLogs,
      l => (l.action === 'PUBLISH_SHARE') && l.resourceId === shareId
    );
    expect(publishCount).toBe(1);

    const publishMsg = await waitForWebSocketMessage(
      m => m.type === 'share' && m.data.id === shareId && m.data.status === 'published'
    );
    expect(publishMsg).toBeTruthy();

    // 5) Ensure idempotence
    wsMessages = [];
    await processScheduledShares();
    await new Promise(r => setTimeout(r, 500));
    const finalLogs = takeFileSnapshot(AUDIT_LOGS_FILE);
    const totalPublish = countEntriesBy(
      finalLogs,
      l => l.action === 'PUBLISH_SHARE' && l.resourceId === shareId
    ) - countEntriesBy(
      originalAuditLogs,
      l => l.action === 'PUBLISH_SHARE' && l.resourceId === shareId
    );
    expect(totalPublish).toBe(1);
    expect(wsMessages.find(m => m.data.id === shareId)).toBeUndefined();
  }, 30000);
});
