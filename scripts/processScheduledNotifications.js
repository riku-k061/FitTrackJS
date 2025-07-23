const { processDueNotifications }    = require('../utils/notificationQueueService');
const { processNotificationBatch }   = require('../services/notificationProcessor');
const logger                         = require('../utils/loggerUtils');

async function processDueNotificationsJob() {
  const { processed, remaining } = await processDueNotifications();
  logger.info(`Due: ${processed.length}, Remain: ${remaining}`);
  if (processed.length) {
    const results = await processNotificationBatch(processed);
    logger.info(`Sent: ${results.success.length}, Failed: ${results.failed.length}`);
  }
}

if (require.main===module) {
  processDueNotificationsJob()
    .then(()=>process.exit(0))
    .catch(()=>process.exit(1));
}

module.exports = { processDueNotificationsJob };
