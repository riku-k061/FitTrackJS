require('dotenv').config();
const app = require('./app');
const config = require('./config/config');
const { flushAllWrites } = require('./utils/fileUtils');
const { initializeWebSocketServer } = require('./utils/websocketService');

const PORT = config.port;

console.log(`Using bcrypt salt rounds: ${config.saltRounds}`);
const server = app.listen(PORT, () => {
  console.log(`FitTrackJS server running on port ${PORT}`);
});

// Initialize WebSocket server
initializeWebSocketServer(server);

async function gracefulShutdown() {
  console.log('Shutdown signal received, flushing data...');
  try {
    await flushAllWrites();
    console.log('Pending data saved.');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = server;
