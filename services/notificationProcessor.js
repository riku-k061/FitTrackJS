const createResourceService = require('../utils/createResourceService');
const { notificationSchema } = require('../models/notificationModel');
const { sendEmail } = require('./emailService');
const logger = require('../utils/loggerUtils');

const notifSvc = createResourceService('notifications');

async function sendNotification(n) {
  switch(n.type){
    case 'email':  return sendEmailNotification(n);
    case 'in_app': return sendInAppNotification(n);
    case 'push':   return sendPushNotification(n);
    case 'sms':    return sendSmsNotification(n);
    default: throw new Error(`Unknown type: ${n.type}`);
  }
}

async function sendEmailNotification(n) {
  const { success, messageId } = await sendEmail({
    to: n.recipient, subject: n.subject,
    text: n.message, html: n.htmlContent
  });
  return { success, messageId };
}

async function sendInAppNotification(n){
  logger.info(`In-app → user ${n.userId}: ${n.message}`);
  return { success: true };
}
async function sendPushNotification(n){
  logger.info(`Push → user ${n.userId}: ${n.message}`);
  return { success: true };
}
async function sendSmsNotification(n){
  logger.info(`SMS → user ${n.userId}: ${n.message}`);
  return { success: true };
}

async function processNotificationBatch(arr){
  const results = { success: [], failed: [] };
  for(const n of arr){
    try {
      const r = await sendNotification(n);
      if(r.success){
        await notifSvc.update(n.id,{ sentStatus:'sent', sentAt:new Date().toISOString(), ...(r.messageId?{ messageId:r.messageId }:{}) });
        results.success.push(n.id);
      } else throw new Error('Send failed');
    } catch(err){
      const retry = (n.retryCount||0)+1;
      await notifSvc.update(n.id,{ sentStatus:'failed', lastAttempt:new Date().toISOString(), errorMessage:err.message, retryCount:retry });
      results.failed.push(n.id);
    }
  }
  return results;
}

module.exports = { processNotificationBatch };
