// tests/integration/analyticsEndpoints.test.js
const request = require('supertest');
const app = require('../../app');
const fileService = require('../../utils/fileService');
const { v4: uuidv4 } = require('uuid');
const userCacheUtils = require('../../utils/userCacheUtils');
const analyticsController = require('../../controllers/analyticsController');
jest.mock('../../utils/userCacheUtils', () => ({
  ...jest.requireActual('../../utils/userCacheUtils'),
  userExists: jest.fn(async () => true)
}));

describe('Analytics API Integration Tests', () => {
  let testUser;
  let authToken;
  const password = 'Test@123';
  const createdWorkouts = [];
  const createdNutritionLogs = [];

  beforeAll(async () => {
    // Create and register test user
    const id = uuidv4().slice(0, 8);
    testUser = {
      username: `user_${id}`,
      email: `user_${id}@test.com`,
      password,
      name: 'Test User',
      birthDate: '1990-01-01',
      sex: 'female',
      height: 170,
      weight: 65,
      timezone: 'America/New_York'
    };
    await request(app).post('/users').send(testUser).expect(201);
    const login = await request(app).post('/auth/login')
      .send({ email: testUser.email, password })
      .expect(200);
    authToken = login.body.data.tokens.accessToken;
    testUser.id = login.body.data.user.id;
  });

  afterAll(async () => {
    // Cleanup workouts
    let all = await fileService.getAll('workouts');
    const filteredWorkouts = all.filter(w => !createdWorkouts.includes(w.id));
    await fileService.queueWrite('workouts', filteredWorkouts);
    
    // Cleanup nutrition
    all = await fileService.getAll('nutritionLogs');
    const filteredNutrition = all.filter(n => !createdNutritionLogs.includes(n.id));
    await fileService.queueWrite('nutritionLogs', filteredNutrition);
    
    // Cleanup user
    all = await fileService.getAll('users');
    const filteredUsers = all.filter(u => u.id !== testUser.id);
    await fileService.queueWrite('users', filteredUsers);
  });

  it('creates workouts and logs nutrition, then verifies analytics', async () => {
    // Create workouts
    const workouts = [
      { exerciseType:'cardio',  date: new Date(Date.now()-1*864e5).toISOString(), duration:30, caloriesBurned:300 },
      { exerciseType:'cardio',  date: new Date(Date.now()-2*864e5).toISOString(), duration:45, caloriesBurned:400 }
    ];
    for (const w of workouts) {
      const res = await request(app).post('/workouts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(w);
      if (res.status !== 201) {
        console.error('Workout creation error:', res.body);
      }
      expect(res.status).toBe(201);
      createdWorkouts.push(res.body.id);
    }

    // Create nutrition logs
    const logs = [
      { date: new Date(Date.now()-1*864e5).toISOString().slice(0,10), mealType:'breakfast', calories:500, protein:20, carbs:50, fat:10, userId: testUser.id },
      { date: new Date(Date.now()-2*864e5).toISOString().slice(0,10), mealType:'dinner',    calories:700, protein:30, carbs:60, fat:20, userId: testUser.id }
    ];
    for (const n of logs) {
      const res = await request(app).post('/api/nutrition')
        .set('Authorization', `Bearer ${authToken}`)
        .send(n);
      if (res.status !== 201) {
        console.error('Nutrition creation error:', res.body);
      }
      expect(res.status).toBe(201);
      createdNutritionLogs.push(res.body.id);
    }

    // Fetch analytics
    const analytics = await request(app).get(`/api/analytics/${testUser.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    const data = analytics.body.data;
    expect(data.totalWorkoutDuration).toBe(75);       // 30 + 45
    expect(data.totalCaloriesBurned).toBe(700);       // 300 + 400
    expect(data.totalCaloriesIntake).toBe(1200);      // 500 + 700
  });

  it('caches analytics on second request', async () => {
    // Clear cache before test to ensure clean state
    analyticsController.clearAnalyticsCache();
    
    const first = await request(app).get(`/api/analytics/${testUser.id}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(first.body.fromCache).toBe(false);

    const second = await request(app).get(`/api/analytics/${testUser.id}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(second.body.fromCache).toBe(true);
  });

  it('invalidates cache after new workout', async () => {
    // Add another workout
    const res = await request(app).post('/workouts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ exerciseType:'flexibility', date: new Date().toISOString(), duration:60, caloriesBurned:200 });
    expect(res.status).toBe(201);
    createdWorkouts.push(res.body.id);

    const analytics = await request(app).get(`/api/analytics/${testUser.id}?bypassCache=true`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(analytics.body.fromCache).toBe(false);
    expect(analytics.body.data.totalWorkoutDuration).toBe(135); // 75 + 60
    expect(analytics.body.data.totalCaloriesBurned).toBe(900);  // 700 + 200
  });

  it('exports analytics as CSV and PDF', async () => {
    const csv = await request(app).get(`/api/analytics/${testUser.id}/download?format=csv`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(csv.headers['content-type']).toContain('text/csv');

    const pdf = await request(app).get(`/api/analytics/${testUser.id}/download?format=pdf`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.toString('ascii', 0, 4)).toBe('%PDF');
  });

  it('handles non-existent user and invalid params', async () => {
    await request(app).get('/api/analytics/does-not-exist')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);

    await request(app).get(`/api/analytics/${testUser.id}/download?format=xml`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);
  });
});
