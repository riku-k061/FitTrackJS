const fs = require('fs').promises;
const { getDataFilePath } = require('./fileUtils');
const createResourceService = require('./createResourceService');
const { notificationSchema } = require('../models/notificationModel');
const { executeTransaction } = require('./transactionUtils');

const NOTIF_FILE = 'notifications.json';
const QUEUE_FILE = 'notificationQueue.json';
const notifSvc = createResourceService('notifications');

async function ensureQueue() {
  try { await fs.access(getDataFilePath(QUEUE_FILE)); }
  catch { await fs.writeFile(getDataFilePath(QUEUE_FILE), '[]'); }
}

async function createAndQueueNotification(n) {
  return executeTransaction(async tx => {
    await tx.backup(NOTIF_FILE); await tx.backup(QUEUE_FILE);
    const notifs = JSON.parse(await fs.readFile(getDataFilePath(NOTIF_FILE),'utf8'));
    const queue  = JSON.parse(await fs.readFile(getDataFilePath(QUEUE_FILE),'utf8'));
    notifs.push(n); queue.push(n);
    queue.sort((a,b)=>new Date(a.sendAt)-new Date(b.sendAt));
    await tx.writeFile(NOTIF_FILE, notifs);
    await tx.writeFile(QUEUE_FILE, queue);
    return n;
  });
}

async function enqueueNotification(n) {
  return executeTransaction(async tx => {
    await tx.backup(QUEUE_FILE);
    const queue = JSON.parse(await fs.readFile(getDataFilePath(QUEUE_FILE),'utf8'));
    const i = queue.findIndex(x=>x.id===n.id);
    if (~i) queue[i] = n; else queue.push(n);
    queue.sort((a,b)=>new Date(a.sendAt)-new Date(b.sendAt));
    await tx.writeFile(QUEUE_FILE, queue);
    return n;
  });
}

async function processDueNotifications() {
  return executeTransaction(async tx => {
    await tx.backup(QUEUE_FILE);
    const queue = JSON.parse(await fs.readFile(getDataFilePath(QUEUE_FILE),'utf8'));
    const now = new Date(), due = [], rem = [];
    queue.forEach(n=> new Date(n.sendAt)<=now ? due.push(n) : rem.push(n));
    await tx.writeFile(QUEUE_FILE, rem);
    return { processed: due, remaining: rem.length };
  });
}

async function getQueuedNotifications() {
  await ensureQueue();
  return JSON.parse(await fs.readFile(getDataFilePath(QUEUE_FILE),'utf8'));
}

async function dequeueNotification(id) {
  return executeTransaction(async tx => {
    await tx.backup(QUEUE_FILE);
    const queue = JSON.parse(await fs.readFile(getDataFilePath(QUEUE_FILE),'utf8'));
    const out = queue.filter(n=>n.id!==id);
    if (out.length===queue.length) throw new Error(`Not in queue: ${id}`);
    await tx.writeFile(QUEUE_FILE, out);
    return { success: true };
  });
}

module.exports = {
  createAndQueueNotification,
  enqueueNotification,
  processDueNotifications,
  getQueuedNotifications,
  dequeueNotification
};
