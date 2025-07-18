const { getWebSocketServer } = require('./websocketService');

const CHANNELS = {
  ALL: 'shares',
  USER: (uid) => `shares.user.${uid}`
};

function broadcastShareUpdate(share, action, userId) {
  try {
    const wss = getWebSocketServer();
    const msg = { type:'share', action, timestamp:new Date().toISOString(), data: share };
    wss.broadcastToChannel(CHANNELS.ALL, msg);
    wss.broadcastToChannel(CHANNELS.USER(userId), msg);
  } catch (err) {
    console.error('WS broadcast error:', err);
  }
}

module.exports = { SHARE_CHANNELS: CHANNELS, broadcastShareUpdate };
