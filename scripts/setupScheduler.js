const cron = require('node-cron');
const processScheduledShares = require('./processScheduledShares');
const { logAuditEvent } = require('../utils/auditLogUtils');

module.exports = function setupScheduler() {
  console.log('Scheduler initializing…');
  cron.schedule('* * * * *', async () => {
    try {
      console.log('Cron tick:', new Date().toISOString());
      await processScheduledShares();
    } catch (err) {
      console.error('Cron error:', err);
      await logAuditEvent({
        userId:'system', action:'SCHEDULER_ERROR',
        details: err.message, resourceType:'system'
      });
    }
  });
  console.log('Scheduler running every minute');
};
