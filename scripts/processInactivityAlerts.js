const { processInactiveUsers } = require('../services/inactivityAlertService');
const logger                   = require('../utils/loggerUtils');

async function checkInactiveUsersJob() {
  logger.info('Running inactivity check');
  const res = await processInactiveUsers(3);
  logger.info(`Queued ${res.queued} inactivity notifications`);
}

if (require.main===module) {
  checkInactiveUsersJob()
    .then(()=>process.exit(0))
    .catch(()=>process.exit(1));
}

module.exports = { checkInactiveUsersJob };
