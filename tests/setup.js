const { v4: uuidv4 } = require('uuid');

// Create mock user data for testing
const mockUserId = 'test-user-123';
const mockAdminId = 'admin-user-456';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.SALT_ROUNDS = '4';

jest.setTimeout(10000);

global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  error: console.error,
  warn: console.warn
};

const mockUsers = [
  {
    id: mockUserId,
    name: 'Test User',
    email: 'test@example.com',
    password: '$2b$10$abcdefghijklmnopqrstuvwxyz', // hashed "password123"
    role: 'user',
    height: 175,
    weight: 70,
    goals: ['weight loss', 'muscle gain']
  },
  {
    id: mockAdminId,
    name: 'Admin User',
    email: 'admin@example.com',
    password: '$2b$10$abcdefghijklmnopqrstuvwxyz', // hashed "password123"
    role: 'admin',
    height: 180,
    weight: 75,
    goals: ['maintenance']
  }
];

// Create mock workout data
const mockWorkouts = [
  {
    id: 'existing-workout-1',
    userId: mockUserId,
    date: new Date().toISOString(),
    exerciseType: 'cardio',
    duration: 30,
    caloriesBurned: 250,
    reps: 0,
    sets: 0
  },
  {
    id: 'admin-workout-1',
    userId: mockAdminId,
    date: new Date().toISOString(),
    exerciseType: 'strength',
    duration: 45,
    caloriesBurned: 350,
    reps: 10,
    sets: 3
  }
];

// Mock audit logs
const mockAuditLogs = [];

// Mock refresh tokens
const mockRefreshTokens = [];

// Export mock data and IDs for tests
module.exports = {
  mockUserId,
  mockAdminId,
  mockUsers,
  mockWorkouts,
  mockAuditLogs,
  mockRefreshTokens
};
