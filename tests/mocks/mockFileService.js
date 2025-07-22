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
  'data/refresh_tokens.json': [...mockRefreshTokens],
  'data/fitnessGoals.json': []
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
  readJSONFile: jest.fn((filename) => {
    // Handle both full paths and relative filenames
    let dataKey;
    if (filename.includes('fitnessGoals.json')) {
      dataKey = 'data/fitnessGoals.json';
    } else if (filename.includes('/')) {
      // Full path, extract the relevant part
      const parts = filename.split('/');
      dataKey = parts.slice(-2).join('/'); // Get last two parts like "data/filename.json"
    } else {
      // Just filename, assume it's in data directory
      dataKey = `data/${filename}`;
    }
    return Promise.resolve([...mockDataStore[dataKey] || []]);
  }),
  writeJSONFile: jest.fn((filename, data) => {
    // Handle both full paths and relative filenames
    let dataKey;
    if (filename.includes('fitnessGoals.json')) {
      dataKey = 'data/fitnessGoals.json';
    } else if (filename.includes('/')) {
      // Full path, extract the relevant part
      const parts = filename.split('/');
      dataKey = parts.slice(-2).join('/'); // Get last two parts like "data/filename.json"
    } else {
      // Just filename, assume it's in data directory
      dataKey = `data/${filename}`;
    }
    mockDataStore[dataKey] = [...data];
    return Promise.resolve();
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
  mockDataStore['data/fitnessGoals.json'] = [];
}

function clearMockHistory() {
  jest.clearAllMocks();
}

function getFileContent(fileName) {
  // For backward compatibility with tests that use specific file names
  if (fileName === 'auditLogs') {
    return getMockData('data/auditLogs.json');
  }
  if (fileName === 'fitnessGoals') {
    return getMockData('data/fitnessGoals.json');
  }
  return getMockData(fileName);
}

function setMockData(filePath, data) {
  mockDataStore[filePath] = [...data];
}

module.exports = {
  getMockData,
  resetMockData,
  clearMockHistory,
  getFileContent,
  setMockData
};
