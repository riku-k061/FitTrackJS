const { v4: uuidv4 } = require('uuid');
const { backupFile, restoreFromBackup } = require('./transactionUtils');
const { readJSONFile, writeJSONFile } = require('./fileUtils');
const { readDataFile, writeDataFile } = require('./fileUtils');
const AUDIT_LOG_FILE = 'auditLogs.json';

function computeDiff(oldObj, newObj) {
  const changes = {};
  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  keys.forEach(key => {
    if (key === 'password') return;
    if (JSON.stringify(oldObj[key]) === JSON.stringify(newObj[key])) return;
    changes[key] = { oldValue: oldObj[key], newValue: newObj[key] };
  });
  return changes;
}

async function createAuditLog(entityType, entityId, action, changes, actor) {
  const log = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    entityType,
    entityId,
    action,
    changes,
    actor: { id: actor.sub, role: actor.role, name: actor.name }
  };
  const logs = await readJSONFile(AUDIT_LOG_FILE);
  logs.push(log);
  await writeJSONFile(AUDIT_LOG_FILE, logs);
  return log;
}

async function prepareDeleteAuditLog(entityType, entityId, deletedEntity, actor) {
  await backupFile(AUDIT_LOG_FILE);
  const entry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    entityType,
    entityId,
    action: 'delete',
    deletedEntity: { ...deletedEntity, password: '[REDACTED]' },
    actor: { id: actor.sub, role: actor.role, name: actor.name }
  };
  return {
    execute: async () => {
      const logs = await readJSONFile(AUDIT_LOG_FILE);
      logs.push(entry);
      await writeJSONFile(AUDIT_LOG_FILE, logs);
      return entry;
    },
    rollback: async () => restoreFromBackup(AUDIT_LOG_FILE)
  };
}

function computeDiff(oldVal, newVal) {
  if (!oldVal) return { added: newVal };
  if (!newVal) return { removed: oldVal };
  const diff = {};
  const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
  for (const key of keys) {
    if (key === 'id' || key === 'password') continue;
    if (JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key])) {
      diff[key] = { old: oldVal[key], new: newVal[key] };
    }
  }
  return diff;
}

async function createAuditLog(params) {
  const { entityType, entityId, action, userId, changes } = params;
  const diff = changes.oldValues || changes.newValues
    ? computeDiff(changes.oldValues, changes.newValues)
    : changes;
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    entityType,
    entityId,
    action,
    userId,
    changes: diff
  };
}

async function logAuditEvent(params) {
  const entry = await createAuditLog(params);
  const logs = await readDataFile(AUDIT_LOG_FILE);
  logs.push(entry);
  await writeDataFile(AUDIT_LOG_FILE, logs);
  return entry;
}

async function prepareAuditLog(params) {
  return createAuditLog(params);
}

async function addAuditLog(entry) {
  const logs = await readDataFile(AUDIT_LOG_FILE);
  logs.push(entry);
  await writeDataFile(AUDIT_LOG_FILE, logs);
}

module.exports = { 
    computeDiff, 
    createAuditLog, 
    prepareDeleteAuditLog,
    logAuditEvent,
    prepareAuditLog,
    addAuditLog,
    computeDiff
};
