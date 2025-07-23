const { v4: uuidv4 } = require('uuid');
const { validate } = require('../utils/validation');

const notificationSchema = {
  id: { type: 'string', required: true },
  userId: { type: 'string', required: true },
  type: { type: 'string', required: true, enum: ['email','in_app','push','sms'] },
  message: { type: 'string', required: true },
  sendAt: { type: 'string', required: true },
  sentStatus: { type: 'string', required: true, enum: ['pending','sent','failed','cancelled'] },
  createdAt: { type: 'string', required: true },
  recipient: { type: 'string', required: false },
  subject: { type: 'string', required: false },
  htmlContent: { type: 'string', required: false },
  errorMessage: { type: 'string', required: false },
  retryCount: { type: 'number', required: false },
  lastAttempt: { type: 'string', required: false },
  sentAt: { type: 'string', required: false }
};

function createNotification(data) {
  const now = new Date().toISOString();
  const n = {
    id: uuidv4(),
    userId: data.userId,
    type: data.type,
    message: data.message,
    sendAt: data.sendAt || now,
    sentStatus: data.sentStatus || 'pending',
    createdAt: now,
    retryCount: 0
  };
  if (data.type === 'email') {
    if (!data.recipient || !data.subject) {
      throw new Error('Email notifications require recipient and subject');
    }
    n.recipient    = data.recipient;
    n.subject      = data.subject;
    n.htmlContent  = data.htmlContent || '';
  }
  const result = validate(n, notificationSchema);
  if (!result.valid) throw new Error(`Invalid notification: ${result.errors.join(', ')}`);
  return n;
}

module.exports = { notificationSchema, createNotification };
