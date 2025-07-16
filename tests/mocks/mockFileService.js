// tests/mocks/mockFileService.js
const { 
  mockUsers, 
  mockWorkouts,
  mockAuditLogs,
  mockRefreshTokens
} = require('../setup');

// In-memory mock data store
const mockDataStore = {
  'data/users.json': [...mockUsers],
  'data/workouts.json': [...mockWorkouts],
  'data/auditLogs.json': [...mockAuditLogs],
  'data/refresh_tokens.json': [...mockRefreshTokens]
};

// Mock the file utils module
jest.mock('../../utils/fileUtils', () => ({
  readDataFile: jest.fn((filePath) =>
    Promise.resolve([...mockDataStore[filePath] || []])
  ),
  writeDataFile: jest.fn((filePath, data) => {
    mockDataStore[filePath] = [...data];
    return Promise.resolve([...data]);
  }),
  flushAllWrites: jest.fn(() => Promise.resolve()),
  clearCache: jest.fn(),
  getCacheStats: jest.fn(() => ({
    cacheSize: Object.keys(mockDataStore).length,
    cachedFiles: Object.keys(mockDataStore),
    queuedWrites: {}
  })),
  onUpdate: jest.fn(),
  offUpdate: jest.fn(),
  fileCache: {
    onUpdate: jest.fn(),
    offUpdate: jest.fn()
  }
}));

// Helpers to inspect and reset mock data
function getMockData(filePath) {
  return mockDataStore[filePath] ? [...mockDataStore[filePath]] : [];
}

function resetMockData() {
  mockDataStore['data/users.json'] = [...mockUsers];
  mockDataStore['data/workouts.json'] = [...mockWorkouts];
  mockDataStore['data/auditLogs.json'] = [...mockAuditLogs];
  mockDataStore['data/refresh_tokens.json'] = [...mockRefreshTokens];
}

function clearMockHistory() {
  jest.clearAllMocks();
}

module.exports = {
  getMockData,
  resetMockData,
  clearMockHistory
};
