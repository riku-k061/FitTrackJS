// tests/integration/notificationE2E.test.js
const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

// Server imports
const app = require('../../app');
const server = require('../../server');
const { processDueNotificationsJob } = require('../../scripts/processScheduledNotifications');
const { getDataFilePath } = require('../../utils/fileUtils');

// Mocked email service
const emailService = require('../../services/emailService');
jest.mock('../../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock-message-id-12345',
    previewUrl: 'https://ethereal.email/message/mock12345'
  })
}));

describe.skip('Notification End-to-End Test', () => {
  let authToken, wsClient, wsMessages = [], testUser, notificationId;
  const wsUrl = 'ws://localhost:3000/ws/notifications';

  // Helper to connect WebSocket
  const connectWS = token => new Promise((resolve, reject) => {
    const client = new WebSocket(`${wsUrl}?token=${token}`);
    client.on('open', () => resolve(client));
    client.on('message', data => wsMessages.push(JSON.parse(data)));
    client.on('error', reject);
  });

  // Wait for a WS message matching predicate
  const waitForWS = (pred, timeout=5000) => new Promise((res, rej) => {
    const check = () => {
      const m = wsMessages.find(pred);
      if (m) return res(m);
    };
    check();
    const interval = setInterval(check, 100);
    const timer = setTimeout(() => {
      clearInterval(interval);
      rej(new Error('WS timeout'));
    }, timeout);
    wsClient.on('message', () => check());
  });

  // Read notifications.json
  const readNotifs = async () => JSON.parse(
    await fs.readFile(getDataFilePath('notifications.json'), 'utf8')
  );
  const getNotif = async id => (await readNotifs()).find(n=>n.id===id);

  // Cleanup
  const cleanup = async () => {
    for (const file of ['notifications.json','notificationQueue.json']) {
      const p = getDataFilePath(file);
      const arr = JSON.parse(await fs.readFile(p,'utf8'));
      await fs.writeFile(p, JSON.stringify(arr.filter(n=>n.userId!==testUser.id),null,2));
    }
  };

  beforeAll(async () => {
    testUser = { id:`user${Date.now()}`, email:'t@e.com', role:'user' };
    authToken = jwt.sign(testUser, process.env.JWT_SECRET||'secret');
    wsClient = await connectWS(authToken);
    await cleanup();
  });

  afterAll(async () => {
    wsClient.close();
    await cleanup();
    await new Promise(r=>server.close(r));
  });

  beforeEach(() => {
    wsMessages = [];
    jest.clearAllMocks();
  });

  it('schedules and processes a notification end-to-end', async () => {
    const notif = {
      userId: testUser.id, type:'email',
      message:'Test', recipient:testUser.email,
      subject:'Subj', htmlContent:'<p>Test</p>',
      sendAt:new Date(Date.now()+1000).toISOString()
    };

    const res = await request(app)
      .post('/api/notifications/schedule')
      .set('Authorization',`Bearer ${authToken}`)
      .send(notif)
      .expect(201);

    notificationId = res.body.id;
    expect(res.body.scheduled).toBe(true);
    expect(res.body.sentStatus).toBe('pending');

    await new Promise(r=>setTimeout(r,1500));
    const jobRes = await processDueNotificationsJob();

    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(jobRes.success).toBe(true);

    const wsMsg = await waitForWS(m=>m.type==='notification'&&m.action==='updated'&&m.data.id===notificationId&&m.data.sentStatus==='sent');
    expect(wsMsg.data.sentAt).toBeDefined();

    const updated = await getNotif(notificationId);
    expect(updated.sentStatus).toBe('sent');
    expect(updated.sentAt).toBeDefined();

    const patch = await request(app)
      .patch(`/api/notifications/${notificationId}/status`)
      .set('Authorization',`Bearer ${authToken}`)
      .send({ status:'read' })
      .expect(200);
    expect(patch.body.success).toBe(true);

    const wsRead = await waitForWS(m=>m.type==='notification'&&m.action==='updated'&&m.data.id===notificationId&&m.data.readStatus==='read');
    expect(wsRead.data.readStatus).toBe('read');

    const final = await getNotif(notificationId);
    expect(final.readStatus).toBe('read');
  },15000);

  it('handles email failure gracefully', async () => {
    emailService.sendEmail.mockRejectedValueOnce(new Error('fail'));
    const notif = {
      userId: testUser.id, type:'email',
      message:'Fail', recipient:testUser.email,
      subject:'FailSubj', htmlContent:'<p>Fail</p>',
      sendAt:new Date(Date.now()+1000).toISOString()
    };
    const res = await request(app)
      .post('/api/notifications/schedule')
      .set('Authorization',`Bearer ${authToken}`)
      .send(notif)
      .expect(201);
    const id = res.body.id;

    await new Promise(r=>setTimeout(r,1500));
    await processDueNotificationsJob();

    const wsFail = await waitForWS(m=>m.type==='notification'&&m.action==='updated'&&m.data.id===id&&m.data.sentStatus==='failed');
    expect(wsFail.data.errorMessage).toBeDefined();

    const u = await getNotif(id);
    expect(u.sentStatus).toBe('failed');
    expect(u.retryCount).toBe(1);
  },15000);
});
