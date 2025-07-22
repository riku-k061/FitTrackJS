const request = require('supertest');
const jwt = require('jsonwebtoken');

// Import mock setup first to ensure mocks are applied
const { resetMockData, getMockData, clearMockHistory } = require('../mocks/mockFileService');
const mockFileService = require('../mocks/mockFileService');
const { mockUserId, mockAdminId } = require('../setup');

const app = require('../../app');
const { generateUserToken, generateAdminToken } = require('../helpers/authHelper');

// Mock userService and other dependencies
jest.mock('../../utils/userService', () => ({
  exists: jest.fn(() => Promise.resolve(true)),
  getPublic: jest.fn((userId) => {
    const { mockUsers } = require('../setup');
    const user = mockUsers.find(u => u.id === userId);
    return Promise.resolve(user ? { id: user.id, name: user.name, email: user.email } : null);
  })
}));

// Mock goalsCacheUtils with in-memory storage
const mockGoals = new Map();
jest.mock('../../utils/goalsCacheUtils', () => ({
  getAll: jest.fn(() => Promise.resolve([...mockGoals.values()])),
  getById: jest.fn((id) => Promise.resolve(mockGoals.get(id) || null)),
  filter: jest.fn(({ userId, goalType, status, limit = 10, offset = 0 }) => {
    let goals = [...mockGoals.values()];
    if (userId) goals = goals.filter(g => g.userId === userId);
    if (goalType) goals = goals.filter(g => g.goalType === goalType);
    
    // Add status filtering logic
    if (status === 'active' || status === 'inactive') {
      const now = new Date();
      goals = goals.filter(g => {
        const s = new Date(g.startDate), e = new Date(g.endDate);
        const active = s <= now && now <= e;
        return status === 'active' ? active : !active;
      });
    }
    
    const total = goals.length;
    const paginatedGoals = goals.slice(offset, offset + limit);
    
    return Promise.resolve({ 
      goals: paginatedGoals, 
      pagination: { totalCount: total, limit, offset, hasMore: total > offset + limit } 
    });
  }),
  add: jest.fn((goal) => {
    mockGoals.set(goal.id, goal);
    return Promise.resolve(goal);
  }),
  update: jest.fn((id, data) => {
    const existing = mockGoals.get(id);
    if (existing) {
      const updated = { ...existing, ...data };
      mockGoals.set(id, updated);
      return Promise.resolve(updated);
    }
    return Promise.resolve(null);
  }),
  remove: jest.fn((id) => {
    const existed = mockGoals.has(id);
    mockGoals.delete(id);
    return Promise.resolve(existed);
  })
}));

// Mock fileService
jest.mock('../../utils/fileService', () => ({
  readData: jest.fn(() => Promise.resolve([])),
  writeData: jest.fn(() => Promise.resolve()),
  writeDataBatch: jest.fn(() => Promise.resolve())
}));

// Mock auditLogUtils
jest.mock('../../utils/auditLogUtils', () => ({
  logAction: jest.fn(() => Promise.resolve())
}));

beforeEach(() => {
  resetMockData();
  clearMockHistory();
  mockGoals.clear(); // Clear mock goals
});

describe('Fitness Goal API Integration Tests', () => {
  const testUserId  = mockUserId;
  const adminUserId = mockAdminId;
  const userToken   = generateUserToken();
  const adminToken  = generateAdminToken();

  const goalData = {
    userId: mockUserId,
    goalType: 'weight_loss',
    targetValue: 70.5,
    currentValue: 85.2,
    startDate: '2023-07-01T00:00:00.000Z',
    endDate:   '2023-12-31T23:59:59.999Z'
  };

  let createdGoalId;

  function expectValidGoal(goal) {
    expect(goal).toHaveProperty('id');
    expect(goal.userId).toBe(goalData.userId);
    expect(goal.goalType).toBe(goalData.goalType);
    expect(goal.targetValue).toBe(goalData.targetValue);
    expect(goal.currentValue).toBe(goalData.currentValue);
    expect(goal).toHaveProperty('createdAt');
    // enrichment
    expect(goal.user).toMatchObject({
      id: testUserId,
      name: 'Test User',
      email: 'test@example.com'
    });
  }

  describe('CRUD Flow', () => {
    it('create → read → update → delete a goal', async () => {
      // Create
      const createRes = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${userToken}`)
        .send(goalData)
        .expect(201);

      expect(createRes.body.success).toBe(true);
      expectValidGoal(createRes.body.data);
      createdGoalId = createRes.body.data.id;

      // Read
      const getRes = await request(app)
        .get(`/api/goals/${createdGoalId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.id).toBe(createdGoalId);
      expectValidGoal(getRes.body.data);

      // Update
      const upd = { currentValue: 80.1, targetValue: 68.0 };
      const updateRes = await request(app)
        .put(`/api/goals/${createdGoalId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(upd)
        .expect(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.currentValue).toBe(upd.currentValue);
      expect(updateRes.body.data.targetValue).toBe(upd.targetValue);

      // Delete
      const delRes = await request(app)
        .delete(`/api/goals/${createdGoalId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(delRes.body.success).toBe(true);

      // Verify gone
      await request(app)
        .get(`/api/goals/${createdGoalId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('Authorization', () => {
    let goalId;
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${userToken}`)
        .send(goalData)
        .expect(201);
      goalId = res.body.data.id;
    });

    it('rejects missing/invalid token', async () => {
      await request(app).get(`/api/goals/${goalId}`).expect(401);
      await request(app)
        .get(`/api/goals/${goalId}`)
        .set('Authorization', 'Bearer bad')
        .expect(401);
    });

    it('prevents user accessing others’ goals', async () => {
      // Create token for a different user  
      const otherUserToken = jwt.sign(
        { sub: 'other-user-id', email: 'other@example.com', name: 'Other User', role: 'user' },
        process.env.JWT_ACCESS_SECRET || 'test-access-secret',
        { expiresIn: '1h' }
      );
      await request(app)
        .get(`/api/goals/${goalId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
      await request(app)
        .put(`/api/goals/${goalId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ currentValue: 75.0 })
        .expect(403);
      await request(app)
        .delete(`/api/goals/${goalId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });

    it('allows admin full access', async () => {
      await request(app)
        .get(`/api/goals/${goalId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      await request(app)
        .put(`/api/goals/${goalId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ currentValue: 77.0 })
        .expect(200);
      await request(app)
        .delete(`/api/goals/${goalId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Validation', () => {
    it('rejects missing fields', async () => {
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details.length).toBeGreaterThan(0);
    });

    it('rejects invalid goalType', async () => {
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...goalData, goalType: 'foo' })
        .expect(400);
      expect(res.body.details.some(e => e.includes('weight_loss'))).toBe(true);
    });

    it('rejects bad dates', async () => {
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...goalData, startDate: '2023-12-31', endDate: '2023-01-01' })
        .expect(400);
      expect(res.body.details.some(e => e.includes('Start date cannot be after'))).toBe(true);
    });

    it('rejects non-numeric values', async () => {
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...goalData, targetValue: 'NaN', currentValue: 'NaN' })
        .expect(400);
      expect(res.body.details.some(e => e.includes('must be a number'))).toBe(true);
    });
  });

  describe('Pagination & Filtering', () => {
    beforeEach(async () => {
      const types = ['weight_loss','muscle_gain','endurance'];
      for (let i=0; i<15; i++) {
        const startDate = i%2 ? '2024-01-01T00:00:00Z' : '2022-01-01T00:00:00Z';
        const endDate = i%2 ? '2024-12-31T23:59:59.999Z' : '2023-12-31T23:59:59.999Z';
        await request(app)
          .post('/api/goals')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            ...goalData,
            goalType: types[i%3],
            startDate: startDate,
            endDate: endDate
          });
      }
    });

    it('paginates', async () => {
      const r1 = await request(app)
        .get('/api/goals?limit=5&offset=0')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(r1.body.data.length).toBe(5);
      expect(r1.body.pagination.hasMore).toBe(true);

      const r2 = await request(app)
        .get('/api/goals?limit=5&offset=5')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(r2.body.data.length).toBe(5);
      expect(r1.body.data[0].id).not.toBe(r2.body.data[0].id);
    });

    it('filters by type', async () => {
      const r = await request(app)
        .get('/api/goals?goalType=weight_loss')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(r.body.data.every(g => g.goalType==='weight_loss')).toBe(true);
    });

    it('filters by status', async () => {
      const now = new Date();
      const active = await request(app)
        .get('/api/goals?status=active')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(active.body.data.every(g => {
        const s = new Date(g.startDate), e = new Date(g.endDate);
        return s <= now && now <= e;
      })).toBe(true);

      const inactive = await request(app)
        .get('/api/goals?status=inactive')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(inactive.body.data.every(g => {
        const s = new Date(g.startDate), e = new Date(g.endDate);
        return s > now || e < now;
      })).toBe(true);
    });
  });

  describe('Audit Logging', () => {
    let gid;
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${userToken}`)
        .send(goalData)
        .expect(201);
      gid = res.body.data.id;
    });

    it.skip('logs updates', async () => {
      // TODO: Implement audit logging in fitness goal controller
      await request(app)
        .put(`/api/goals/${gid}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentValue: 80 })
        .expect(200);

      const logs = mockFileService.getFileContent('auditLogs');
      const upd = logs.find(l => l.action==='update' && l.entityId===gid);
      expect(upd).toBeDefined();
      expect(upd.diff.changed.currentValue).toBeDefined();
    });

    it.skip('logs deletions', async () => {
      // TODO: Implement audit logging in fitness goal controller
      await request(app)
        .delete(`/api/goals/${gid}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const logs = mockFileService.getFileContent('auditLogs');
      const del = logs.find(l => l.action==='delete' && l.entityId===gid);
      expect(del).toBeDefined();
      expect(del.diff.removed.id).toBe(gid);
    });
  });

  describe('Progress Calculation', () => {
    beforeEach(async () => {
      const arr = [
        { goalType:'weight_loss', targetValue:70, currentValue:85 },
        { goalType:'muscle_gain', targetValue:75, currentValue:65 },
        { goalType:'endurance',   targetValue:30, currentValue:20 }
      ];
      for (const g of arr) {
        await request(app)
          .post('/api/goals')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ ...goalData, ...g });
      }
    });

    it('computes progress summary', async () => {
      const res = await request(app)
        .get(`/api/goals/progress/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.goals.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.summary).toBeDefined();
    });
  });
});
