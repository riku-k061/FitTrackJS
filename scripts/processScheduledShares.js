const {
  getDueScheduledShares,
  removeProcessedShares
} = require('../utils/schedulerQueue');
const { publishShare } = require('../services/socialMediaPublisher');
const SocialShare = require('../models/socialShareModel');
const { logAuditEvent } = require('../utils/auditLogUtils');

async function processScheduledShares() {
  console.log('Processor start', new Date().toISOString());
  const due = await getDueScheduledShares();
  if (!due.length) return console.log('No due shares');
  const done = [];
  for (const item of due) {
    try {
      const share = await SocialShare.findById(item.shareId);
      if (!share) {
        done.push(item.shareId);
        continue;
      }
      await publishShare(share);
      done.push(share.id);
    } catch (err) {
      console.error(`Error on ${item.shareId}:`, err);
      await logAuditEvent({
        userId: item.userId, action:'SCHEDULER_ERROR',
        details: err.message, resourceId: item.shareId, resourceType:'socialShare'
      });
    }
  }
  if (done.length) {
    await removeProcessedShares(done);
    console.log(`Removed ${done.length} from queue`);
  }
}

if (require.main === module) {
  processScheduledShares()
    .then(()=>process.exit(0))
    .catch(()=>process.exit(1));
}

module.exports = processScheduledShares;
