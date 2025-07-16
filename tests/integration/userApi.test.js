const request = require('supertest');
const app = require('../../app');
const jwt = require('jsonwebtoken');
const config = require('../../config/config');

// Mock the file utilities
jest.mock('../../utils/fileUtils', () => {
  const mockData = {
    'users.json': [],
    'refresh_tokens.json': [],
    'auditLogs.json': []
  };

  return {
    readJSONFile: jest.fn().mockImplementation(async (filename) => {
      return JSON.parse(JSON.stringify(mockData[filename] || []));
    }),
    writeJSONFile: jest.fn().mockImplementation(async (filename, data) => {
      mockData[filename] = JSON.parse(JSON.stringify(data));
      return Promise.resolve();
    }),
    forceWriteJSONFile: jest.fn().mockResolvedValue(),
    invalidateCache: jest.fn(),
    flushAllWrites: jest.fn().mockResolvedValue()
  };
});

// Mock bcrypt to avoid actual hashing
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('mocked-hashed-password'),
  compare: jest.fn().mockImplementation(async (password, hash) => {
    return password === 'Password123!';
  })
}));

describe('User API Flow Integration Tests', () => {
  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'Password123!',
    height: 175,
    weight: 70,
    fitnessGoals: ['Lose weight', 'Run 5K']
  };

  let userId;
  let authTokens;

  beforeAll(() => {
    jest.clearAllMocks();
  });

  describe('1. User Registration', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/users')
        .send(testUser)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe(testUser.name);
      expect(res.body.data.email).toBe(testUser.email);
      expect(res.body.data).not.toHaveProperty('password');
      userId = res.body.data.id;
    });

    it('should reject registration with invalid data', async () => {
      const invalidUser = { name: '', email: 'invalid', password: 'short', height: 1000 };
      const res = await request(app)
        .post('/users')
        .send(invalidUser)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(Array.isArray(res.body.error.details)).toBe(true);
    });

    it('should reject duplicate email registration', async () => {
      const res = await request(app)
        .post('/users')
        .send(testUser)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.details.some(e =>
        e.field === 'email' && e.message.includes('already in use')
      )).toBe(true);
    });
  });

  describe('2. User Authentication', () => {
    it('should return tokens when login is successful', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
      expect(res.body.data.user.id).toBe(userId);

      authTokens = res.body.data.tokens;
      const decoded = jwt.verify(authTokens.accessToken, config.jwt.accessSecret);
      expect(decoded.sub).toBe(userId);
    });

    it('should reject login with invalid credentials', async () => {
      await request(app)
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrong' })
        .expect(401);
    });

    it('should reject login with non-existent user', async () => {
      await request(app)
        .post('/auth/login')
        .send({ email: 'noone@example.com', password: 'Password123!' })
        .expect(401);
    });
  });

  describe('3. Access User Data', () => {
    it('should retrieve user data with valid token', async () => {
      const res = await request(app)
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(userId);
      expect(res.body.data.name).toBe(testUser.name);
      expect(res.body.data.email).toBe(testUser.email);
    });

    it('should reject request without authentication', async () => {
      await request(app)
        .get(`/users/${userId}`)
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app)
        .get(`/users/${userId}`)
        .set('Authorization', 'Bearer invalid')
        .expect(401);
    });

    it('should reject access to non-existent user', async () => {
      await request(app)
        .get('/users/non-existent-id')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(404);
    });
  });

  describe('4. Token Refresh', () => {
    it('should issue new tokens with valid refresh token', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: authTokens.refreshToken })
        .expect(200);

      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
      authTokens = res.body.data.tokens;
    });

    it('should reject invalid refresh token', async () => {
      await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid' })
        .expect(401);
    });
  });

  describe('5. End-to-End Flow', () => {
    it('should complete a full user lifecycle flow', async () => {
      const newUser = {
        name: 'Flow Test',
        email: 'flow@example.com',
        password: 'Password123!',
        height: 180,
        weight: 75,
        fitnessGoals: ['Build muscle']
      };

      const reg = await request(app)
        .post('/users')
        .send(newUser)
        .expect(201);
      const newId = reg.body.data.id;

      const login = await request(app)
        .post('/auth/login')
        .send({ email: newUser.email, password: newUser.password })
        .expect(200);
      const tokens = login.body.data.tokens;

      await request(app)
        .get(`/users/${newId}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      const updateData = { weight: 73, fitnessGoals: ['Build muscle','Run marathon'] };
      const upd = await request(app)
        .put(`/users/${newId}`)
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send(updateData)
        .expect(200);

      expect(upd.body.data.weight).toBe(73);
      expect(upd.body.data.fitnessGoals).toEqual(['Build muscle','Run marathon']);
    });
  });
});
