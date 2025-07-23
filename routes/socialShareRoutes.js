const express = require('express');
const router = express.Router();
const socialShareController = require('../controllers/socialShareController');
const jwtMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware, ROLES } = require('../middleware/roleMiddleware');
const SocialShare = require('../models/socialShareModel');

// Middleware to check ownership of social share resources
const checkOwnership = (Model) => async (req, res, next) => {
  try {
    const resource = await Model.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, error: 'Resource not found' });
    }
    
    if (req.user.role === ROLES.ADMIN) {
      req.resource = resource;
      return next();
    }
    
    if (resource.userId !== req.user.sub) {
      return res.status(403).json({ success: false, error: 'Access denied: You can only access your own resources' });
    }
    
    req.resource = resource;
    next();
  } catch (error) {
    next(error);
  }
};

router.use(jwtMiddleware);

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
