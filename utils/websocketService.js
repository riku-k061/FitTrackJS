const WebSocket = require('ws');
const { createError } = require('./errorUtils');

let wss = null;

function initializeWebSocketServer(server) {
  if (wss) return wss;
  wss = new WebSocket.Server({ server });
  const channels = new Map();

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.channels = new Set();
    ws.on('pong', () => ws.isAlive = true);
    ws.on('message', msg => {
      try {
        const { action, channel } = JSON.parse(msg);
        if (action === 'subscribe' && channel) {
          channels.set(channel, channels.get(channel)||new Set()).add(ws);
          ws.channels.add(channel);
          ws.send(JSON.stringify({ type:'subscription', status:'success', channel }));
        }
        if (action === 'unsubscribe' && channel) {
          channels.get(channel)?.delete(ws);
          ws.channels.delete(channel);
          ws.send(JSON.stringify({ type:'unsubscription', status:'success', channel }));
        }
      } catch {
        ws.send(JSON.stringify({ type:'error', message:'Invalid format' }));
      }
    });
    ws.on('close', () => {
      ws.channels.forEach(c => channels.get(c)?.delete(ws));
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false; ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  wss.broadcastToChannel = (channel, data) => {
    const msg = typeof data==='string'?data:JSON.stringify(data);
    channels.get(channel)?.forEach(c => {
      if (c.readyState===WebSocket.OPEN) c.send(msg);
    });
  };

  return wss;
}

function getWebSocketServer() {
  if (!wss) throw createError('SERVER_ERROR','WS not initialized');
  return wss;
}

module.exports = { initializeWebSocketServer, getWebSocketServer };
