// tests/integration/workoutApi.test.js
const request = require('supertest');

// Import mock setup first to ensure mocks are applied
const { resetMockData, getMockData, clearMockHistory } = require('../mocks/mockFileService');
const { mockUserId, mockAdminId } = require('../setup');

const app = require('../../app');
const { generateUserToken, generateAdminToken, generateExpiredToken } = require('../helpers/authHelper');

// Mock indexingUtils
jest.mock('../../utils/indexingUtils', () => ({
  buildIndexes: jest.fn(() => Promise.resolve()),
  getFilteredData: jest.fn((filePath, options) => {
    const { getMockData } = require('../mocks/mockFileService');
    const data = getMockData(filePath);
    let filtered = [...data];
    if (options.userId) filtered = filtered.filter(item => item.userId === options.userId);
    return Promise.resolve({
      data: filtered,
      pagination: {
        total: filtered.length,
        limit: options.limit || 10,
        offset: options.offset || 0,
        hasMore: false
      }
    });
  }),
  invalidateIndex: jest.fn()
}));

// Mock userCacheUtils
jest.mock('../../utils/userCacheUtils', () => ({
  userExists: jest.fn(userId => {
    const { mockUsers } = require('../setup');
    return Promise.resolve(mockUsers.some(u => u.id === userId));
  }),
  getUserById: jest.fn(userId => {
    const { mockUsers } = require('../setup');
    const u = mockUsers.find(x => x.id === userId);
    return Promise.resolve(u ? { id: u.id, name: u.name, email: u.email } : null);
  }),
  enrichWorkoutsWithUserInfo: jest.fn(workouts => {
    const { mockUsers } = require('../setup');
    return Promise.resolve(workouts.map(w => {
      const u = mockUsers.find(x => x.id === w.userId);
      return { ...w, user: u && { name: u.name, email: u.email } };
    }));
  }),
  invalidateCache: jest.fn()
}));

// Mock workoutStatsUtils
jest.mock('../../utils/workoutStatsUtils', () => ({
  getUserWorkoutStats: jest.fn(() =>
    Promise.resolve({
      summary: { totalWorkouts: 1, totalDuration: 30, totalCaloriesBurned: 250 },
      weeks: [], byExerciseType: {}, trends: { durationTrend: 0, caloriesTrend: 0 }
    })
  ),
  invalidateStatsCache: jest.fn()
}));

beforeEach(() => {
  resetMockData();
  clearMockHistory();
});

describe('Workout API Integration Tests', () => {
  describe('Authentication and Authorization', () => {
    test('rejects requests without auth', async () => {
      const res = await request(app).get('/workouts');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
    test('rejects invalid token', async () => {
      const res = await request(app).get('/workouts').set('Authorization', 'Bearer invalid');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
    test('rejects expired token', async () => {
      const token = generateExpiredToken();
      const res = await request(app).get('/workouts').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('expired');
    });
  });

  describe('Workout CRUD Operations - Full Flow', () => {
    let userToken, adminToken, createdId;
    beforeEach(() => {
      userToken = generateUserToken();
      adminToken = generateAdminToken();
    });

    test('complete CRUD flow', async () => {
      // CREATE
      const newW = { exerciseType:'cardio', duration:45, caloriesBurned:350, date:new Date().toISOString() };
      const c = await request(app)
        .post('/workouts').set('Authorization',`Bearer ${userToken}`).send(newW);
      expect(c.status).toBe(201);
      expect(c.body).toHaveProperty('id');
      expect(c.body.userId).toBe(mockUserId);
      createdId = c.body.id;
      const store = getMockData('data/workouts.json');
      expect(store.find(w=>w.id===createdId)).toBeDefined();

      // READ
      const g = await request(app)
        .get(`/workouts/${createdId}`).set('Authorization',`Bearer ${userToken}`);
      expect(g.status).toBe(200);
      expect(g.body.id).toBe(createdId);
      expect(g.body.user.name).toBe('Test User');

      // UPDATE
      const upd = { exerciseType:'strength', duration:60, caloriesBurned:400, reps:12, sets:3 };
      const u = await request(app)
        .put(`/workouts/${createdId}`).set('Authorization',`Bearer ${userToken}`).send(upd);
      expect(u.status).toBe(200);
      expect(u.body.exerciseType).toBe('strength');
      const afterUpd = getMockData('data/workouts.json').find(w=>w.id===createdId);
      expect(afterUpd.exerciseType).toBe('strength');

      // DELETE
      const d = await request(app)
        .delete(`/workouts/${createdId}`).set('Authorization',`Bearer ${userToken}`);
      expect(d.status).toBe(204);
      const final = getMockData('data/workouts.json').find(w=>w.id===createdId);
      expect(final).toBeUndefined();

      // VERIFY NOT FOUND
      const nf = await request(app)
        .get(`/workouts/${createdId}`).set('Authorization',`Bearer ${userToken}`);
      expect(nf.status).toBe(404);
    });
  });

  describe('Authorization scenarios', () => {
    let userToken, adminToken;
    beforeEach(() => {
      userToken = generateUserToken();
      adminToken = generateAdminToken();
    });

    test('user cannot view another’s workout', async () => {
      const res = await request(app)
        .get('/workouts/admin-workout-1').set('Authorization',`Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
    test('user cannot update another’s workout', async () => {
      const res = await request(app)
        .put('/workouts/admin-workout-1').set('Authorization',`Bearer ${userToken}`).send({ exerciseType:'cardio', duration:30 });
      expect(res.status).toBe(403);
      const w = getMockData('data/workouts.json').find(w=>w.id==='admin-workout-1');
      expect(w.exerciseType).toBe('strength');
    });
    test('admin can CRUD any workout', async () => {
      const view = await request(app)
        .get('/workouts/existing-workout-1').set('Authorization',`Bearer ${adminToken}`);
      expect(view.status).toBe(200);

      const up = await request(app)
        .put('/workouts/existing-workout-1').set('Authorization',`Bearer ${adminToken}`).send({ exerciseType:'flexibility', duration:20 });
      expect(up.status).toBe(200);
      const w = getMockData('data/workouts.json').find(w=>w.id==='existing-workout-1');
      expect(w.exerciseType).toBe('flexibility');

      const del = await request(app)
        .delete('/workouts/existing-workout-1').set('Authorization',`Bearer ${adminToken}`);
      expect(del.status).toBe(204);
      expect(getMockData('data/workouts.json').find(w=>w.id==='existing-workout-1')).toBeUndefined();
    });
  });

  describe('Validation tests', () => {
    let userToken;
    beforeEach(() => { userToken = generateUserToken(); });

    test('rejects invalid exerciseType', async () => {
      const res = await request(app)
        .post('/workouts').set('Authorization',`Bearer ${userToken}`).send({ exerciseType:'bad', duration:30, caloriesBurned:200 });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Exercise type');
    });
    test('rejects negative duration', async () => {
      const res = await request(app)
        .post('/workouts').set('Authorization',`Bearer ${userToken}`).send({ exerciseType:'cardio', duration:-10, caloriesBurned:200 });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Duration');
    });
    test('requires reps/sets for strength', async () => {
      const res = await request(app)
        .post('/workouts').set('Authorization',`Bearer ${userToken}`).send({ exerciseType:'strength', duration:30, caloriesBurned:200 });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('reps and sets');
    });
  });

  describe('Listing and filtering', () => {
    let userToken, adminToken;
    beforeEach(() => {
      userToken = generateUserToken();
      adminToken = generateAdminToken();
    });

    test('user sees only own workouts', async () => {
      const res = await request(app)
        .get('/workouts').set('Authorization',`Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].userId).toBe(mockUserId);
    });
    test('admin sees all workouts', async () => {
      const res = await request(app)
        .get('/workouts').set('Authorization',`Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });
    test('admin filters by userId', async () => {
      const res = await request(app)
        .get(`/workouts?userId=${mockUserId}`).set('Authorization',`Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every(w => w.userId === mockUserId)).toBe(true);
    });
  });

  describe('Statistics endpoint', () => {
    let userToken, adminToken;
    beforeEach(() => {
      userToken = generateUserToken();
      adminToken = generateAdminToken();
    });

    test('user accesses own stats', async () => {
      const res = await request(app)
        .get(`/workouts/stats/${mockUserId}`).set('Authorization',`Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
    });
    test('user can’t access others’ stats', async () => {
      const res = await request(app)
        .get(`/workouts/stats/${mockAdminId}`).set('Authorization',`Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
    test('admin accesses any stats', async () => {
      const res = await request(app)
        .get(`/workouts/stats/${mockUserId}`).set('Authorization',`Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
    });
  });
});
