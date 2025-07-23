// tests/helpers/authHelper.js
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const { mockUserId, mockAdminId } = require('../setup');

// Use the same JWT secret as the application
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';

// Generate a valid user token for testing
function generateUserToken() {
  return jwt.sign(
    {
      sub: mockUserId,
      email: 'test@example.com',
      name: 'Test User',
      role: 'user'
    },
    JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );
}

// Generate a valid admin token for testing
function generateAdminToken() {
  return jwt.sign(
    {
      sub: mockAdminId,
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin'
    },
    JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );
}

// Generate an expired token for testing
function generateExpiredToken() {
  return jwt.sign(
    {
      sub: mockUserId,
      email: 'test@example.com',
      name: 'Test User',
      role: 'user'
    },
    JWT_ACCESS_SECRET,
    { expiresIn: '-10s' }
  );
}

// Get auth token by registering/logging in a user
async function getAuthToken(email, password) {
  try {
    // First try to login
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({ email, password });
    
    if (loginResponse.status === 200) {
      return loginResponse.body.data.tokens.accessToken;
    }
    
    // If login fails, try to register
    const registerResponse = await request(app)
      .post('/users')
      .send({
        username: email.split('@')[0],
        email,
        password,
        name: 'Test User',
        birthDate: '1990-01-01',
        sex: 'female',
        height: 170,
        weight: 65,
        timezone: 'UTC'
      });
    
    if (registerResponse.status === 201) {
      // Now try to login again
      const loginResponse2 = await request(app)
        .post('/auth/login')
        .send({ email, password });
      
      if (loginResponse2.status === 200) {
        return loginResponse2.body.data.tokens.accessToken;
      }
    }
    
    throw new Error('Failed to get auth token');
  } catch (error) {
    console.error('Error getting auth token:', error);
    throw error;
  }
}

module.exports = {
  generateUserToken,
  generateAdminToken,
  generateExpiredToken,
  getAuthToken
};
