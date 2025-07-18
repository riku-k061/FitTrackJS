const express = require('express');
const router = express.Router();
const socialShareController = require('../controllers/socialShareController');
const { protect, checkOwnership } = require('../middleware/authMiddleware');
const SocialShare = require('../models/socialShareModel');

router.use(protect);

router.route('/')
  .get(socialShareController.getShares)
  .post(socialShareController.createShare);

router.route('/scheduled')
  .get(socialShareController.getScheduledShares);

router.route('/:id')
  .get(checkOwnership(SocialShare), socialShareController.getShareById)
  .put(checkOwnership(SocialShare), socialShareController.updateShare)
  .delete(checkOwnership(SocialShare), socialShareController.deleteShare);

module.exports = router;
