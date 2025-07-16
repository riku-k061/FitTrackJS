// tests/helpers/authHelper.js
const jwt = require('jsonwebtoken');
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

module.exports = {
  generateUserToken,
  generateAdminToken,
  generateExpiredToken
};
