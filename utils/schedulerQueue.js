const fs = require('fs');
const path = require('path');
const { readJSONFile, writeJSONFile } = require('./fileService');
const { logAuditEvent } = require('./auditLogUtils');
const { createError } = require('./errorUtils');

const QUEUE_FILE = path.join(__dirname, '../data/scheduledShares.json');
if (!fs.existsSync(QUEUE_FILE)) writeJSONFile(QUEUE_FILE, []);

async function enqueueScheduledShare(share, userId) {
  if (!share.id || !share.scheduledAt) {
    throw createError('VALIDATION_ERROR','Must provide id and scheduledAt');
  }
  const queue = await readJSONFile(QUEUE_FILE);
  const idx = queue.findIndex(i => i.shareId === share.id);
  const item = {
    shareId: share.id,
    userId,
    scheduledAt: share.scheduledAt,
    platform: share.platform,
    enqueuedAt: new Date().toISOString()
  };
  if (idx !== -1) queue[idx] = item;
  else queue.push(item);
  queue.sort((a,b)=> new Date(a.scheduledAt)-new Date(b.scheduledAt));
  await writeJSONFile(QUEUE_FILE, queue);
  await logAuditEvent({
    userId, action: 'SCHEDULE_SHARE',
    details: `Scheduled ${share.id} at ${share.scheduledAt}`,
    resourceId: share.id, resourceType: 'socialShare'
  });
  return true;
}

async function removeFromScheduleQueue(shareId) {
  const queue = await readJSONFile(QUEUE_FILE);
  const filtered = queue.filter(i => i.shareId !== shareId);
  if (filtered.length !== queue.length) {
    await writeJSONFile(QUEUE_FILE, filtered);
    return true;
  }
  return false;
}

async function getDueScheduledShares(referenceTime = new Date()) {
  const queue = await readJSONFile(QUEUE_FILE);
  return queue.filter(i => new Date(i.scheduledAt) <= referenceTime);
}

async function removeProcessedShares(processedIds = []) {
  if (!processedIds.length) return false;
  const queue = await readJSONFile(QUEUE_FILE);
  const filtered = queue.filter(i => !processedIds.includes(i.shareId));
  await writeJSONFile(QUEUE_FILE, filtered);
  return true;
}

module.exports = {
  enqueueScheduledShare,
  removeFromScheduleQueue,
  getDueScheduledShares,
  removeProcessedShares
};
