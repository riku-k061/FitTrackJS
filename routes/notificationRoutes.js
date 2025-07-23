const express = require('express');
const {
  getAllNotifications,
  getNotificationById,
  getUserNotifications,
  createNewNotification,
  updateNotification,
  deleteNotification,
  scheduleNotification,
  getScheduledNotifications,
  cancelScheduledNotification
} = require('../controllers/notificationController');
const jwtMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(jwtMiddleware);

router.get('/',                   getAllNotifications);
router.get('/:id',                getNotificationById);
router.get('/user/:userId',       getUserNotifications);
router.get('/scheduled',          getScheduledNotifications);

router.post('/',                  createNewNotification);
router.post('/schedule',          scheduleNotification);

router.put('/:id',                updateNotification);
router.delete('/:id',             deleteNotification);
router.delete('/scheduled/:id',   cancelScheduledNotification);

module.exports = router;
