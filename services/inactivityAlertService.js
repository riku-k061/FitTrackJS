const createResourceService = require('../utils/createResourceService');
const { enqueueNotification }    = require('../utils/notificationQueueService');
const { createNotification }     = require('../models/notificationModel');
const logger                     = require('../utils/loggerUtils');

const userSvc    = createResourceService('users');
const workoutSvc = createResourceService('workouts');

async function processInactiveUsers(days=3) {
  const users    = await userSvc.getAll();
  const workouts = await workoutSvc.getAll();
  const now      = new Date(),
        cutoff   = new Date(now.getTime() - days*24*60*60*1000);
  const queued   = [];
  for(const u of users){
    if(u.notificationPreferences?.optOut) continue;
    const uw = workouts.filter(w=>w.userId===u.id);
    let last = uw.length ? new Date(Math.max(...uw.map(w=>new Date(w.createdAt)))) : new Date(u.createdAt);
    if(last < cutoff){
      const daysOff = Math.floor((now-last)/(1000*60*60*24));
      const subject = daysOff>14 ? `Your goals still await` :
                      daysOff>7  ? `It's been over a week!` :
                                   `We miss you!`;
      const message = daysOff>14 ? `Two weeks without a workout…` :
                      daysOff>7  ? `A week slipped by…` :
                                   `3 days without a workout…`;
      const notifData = {
        userId: u.id, type:'email', recipient:u.email,
        subject, message,
        htmlContent:`<p>${message}</p><p>It’s been ${daysOff} days.</p>`,
        sendAt:new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,9).toISOString()
      };
      const n = createNotification(notifData);
      await enqueueNotification(n);
      await userSvc.update(u.id,{ inactivityAlertSentAt: now.toISOString() });
      queued.push(n.id);
    }
  }
  logger.info(`Queued ${queued.length} inactivity alerts`);
  return { queued: queued.length };
}

module.exports = { processInactiveUsers };
