// utils/lockService.js
const { v4: uuidv4 } = require('uuid');

class LockService {
  constructor() {
    this.fileLocks = new Map();
    this.resourceLocks = new Map();
    this.queues = new Map();
    this.startLockMonitoring();
  }

  startLockMonitoring() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, lock] of this.fileLocks) {
        if (lock.expiresAt < now) {
          this.fileLocks.delete(key);
          this._processQueue(`file:${key}`);
        }
      }
      for (const [key, lock] of this.resourceLocks) {
        if (lock.expiresAt < now) {
          this.resourceLocks.delete(key);
          this._processQueue(`resource:${key}`);
        }
      }
    }, 5000);
  }

  async acquireFileLock(filename, holder='unknown', timeout=30000) {
    return this._acquireLock('file', filename, `file:${filename}`, this.fileLocks, holder, timeout);
  }
  releaseFileLock(filename, lockId) {
    return this._releaseLock('file', filename, `file:${filename}`, this.fileLocks, lockId);
  }

  async acquireResourceLock(type, id, holder='unknown', timeout=30000) {
    const key = `${type}:${id}`;
    return this._acquireLock('resource', key, `resource:${key}`, this.resourceLocks, holder, timeout);
  }
  releaseResourceLock(type, id, lockId) {
    const key = `${type}:${id}`;
    return this._releaseLock('resource', key, `resource:${key}`, this.resourceLocks, lockId);
  }

  async withFileLock(f, op, h, t) {
    const id = await this.acquireFileLock(f,h,t);
    try { return await op(); } finally { this.releaseFileLock(f,id); }
  }
  async withResourceLock(type,id,op,h,t) {
    const lockId = await this.acquireResourceLock(type,id,h,t);
    try { return await op(); } finally { this.releaseResourceLock(type,id,lockId); }
  }

  async _acquireLock(kind,target,queueKey,map,holder,timeout) {
    if (!map.has(target)) {
      const id = uuidv4();
      map.set(target,{ lockId:id, expiresAt:Date.now()+timeout, lockHolder:holder });
      return id;
    }
    return new Promise((resolve,reject)=>{
      if (!this.queues.has(queueKey)) this.queues.set(queueKey,[]);
      const timeoutId = setTimeout(()=>{
        const q=this.queues.get(queueKey);
        const idx=q.findIndex(x=>x.lockHolder===holder);
        if(idx>=0) q.splice(idx,1);
        reject(new Error(`Timed out waiting for ${kind} lock on ${target}`));
      },timeout);
      this.queues.get(queueKey).push({ resolve, reject, timeoutId, lockHolder:holder });
    });
  }

  _releaseLock(kind,target,queueKey,map,lockId) {
    const lock = map.get(target);
    if (!lock || lock.lockId!==lockId) return false;
    map.delete(target);
    this._processQueue(queueKey);
    return true;
  }

  _processQueue(queueKey) {
    const queue = this.queues.get(queueKey)||[];
    if (!queue.length) return;
    const [kind,target] = queueKey.split(':');
    const lockMap = kind==='file'?this.fileLocks:this.resourceLocks;
    const actual = kind==='file'?target:target.split(':').slice(1).join(':');
    if (lockMap.has(actual)) return;
    const next = queue.shift();
    clearTimeout(next.timeoutId);
    const newId = uuidv4();
    lockMap.set(actual,{ lockId:newId, expiresAt:Date.now()+30000, lockHolder:next.lockHolder });
    next.resolve(newId);
  }
}

module.exports = new LockService();
