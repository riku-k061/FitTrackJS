const { notificationSchema, createNotification } = require('../models/notificationModel');
const createResourceService = require('../utils/createResourceService');
const { handleError }      = require('../utils/errorUtils');
const {
  createAndQueueNotification,
  getQueuedNotifications,
  dequeueNotification
} = require('../utils/notificationQueueService');

const notifSvc = createResourceService('notifications');

async function getAllNotifications(req, res) {
  try { res.json(await notifSvc.getAll()); }
  catch(e){ handleError(res,e); }
}

async function getNotificationById(req, res) {
  try {
    const n = await notifSvc.getById(req.params.id);
    if (!n) return res.status(404).json({ error:'Not found' });
    res.json(n);
  } catch(e){ handleError(res,e); }
}

async function getUserNotifications(req, res) {
  try { res.json(await notifSvc.getByFilter(n=>n.userId===req.params.userId)); }
  catch(e){ handleError(res,e); }
}

async function createNewNotification(req, res) {
  try {
    const n = createNotification(req.body);
    res.status(201).json(await notifSvc.create(n));
  } catch(e){ handleError(res,e); }
}

async function updateNotification(req, res) {
  try { res.json(await notifSvc.update(req.params.id, req.body)); }
  catch(e){ handleError(res,e); }
}

async function deleteNotification(req, res) {
  try { res.json(await notifSvc.delete(req.params.id)); }
  catch(e){ handleError(res,e); }
}

async function scheduleNotification(req, res) {
  try {
    const n = createNotification(req.body);
    const saved = await createAndQueueNotification(n);
    res.status(201).json({ ...saved, scheduled:true });
  } catch(e){ handleError(res,e); }
}

async function getScheduledNotifications(req, res) {
  try { res.json(await getQueuedNotifications()); }
  catch(e){ handleError(res,e); }
}

async function cancelScheduledNotification(req, res) {
  try {
    await dequeueNotification(req.params.id);
    await notifSvc.update(req.params.id,{ sentStatus:'cancelled' });
    res.json({ success:true });
  } catch(e){ handleError(res,e); }
}

module.exports = {
  getAllNotifications,
  getNotificationById,
  getUserNotifications,
  createNewNotification,
  updateNotification,
  deleteNotification,
  scheduleNotification,
  getScheduledNotifications,
  cancelScheduledNotification
};
