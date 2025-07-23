const SocialShare = require('../models/socialShareModel');
const { logAuditEvent } = require('../utils/auditLogUtils');
const { validateEntity } = require('../utils/validation');
const { executeTransaction } = require('../utils/transactionUtils');
const { createError } = require('../utils/errorUtils');
const { broadcastShareUpdate } = require('../utils/shareWebsocketService');
const {
  enqueueScheduledShare,
  removeFromScheduleQueue
} = require('../utils/schedulerQueue');

// GET /api/shares
exports.getShares = async (req, res, next) => {
  try {
    const shares = await SocialShare.findByUserId(req.user.id);
    res.status(200).json({ status: 'success', results: shares.length, data: { shares } });
  } catch (err) { next(err); }
};

// GET /api/shares/scheduled
exports.getScheduledShares = async (req, res, next) => {
  try {
    const shares = await SocialShare.findByUserId(req.user.id);
    const scheduled = shares.filter(s => s.status === 'scheduled' && s.scheduledAt);
    res.status(200).json({ status: 'success', results: scheduled.length, data: { scheduledShares: scheduled } });
  } catch (err) { next(err); }
};

// GET /api/shares/:id
exports.getShareById = async (req, res, next) => {
  try {
    // checkOwnership middleware attached it as req.resource
    const share = req.resource;
    res.status(200).json({ status: 'success', data: { share } });
  } catch (err) { next(err); }
};

// POST /api/shares
exports.createShare = async (req, res, next) => {
  try {
    const result = await executeTransaction(async () => {
      const data = { ...req.body, userId: req.user.id };

      // Security audit if spoofing
      if (req.body.userId && req.body.userId !== req.user.id) {
        await logAuditEvent({
          userId: req.user.id, action: 'SECURITY_WARNING',
          details: `Attempted to set userId=${req.body.userId}`, resourceType: 'socialShare'
        });
      }

      // Scheduling logic
      if (data.scheduledAt) {
        const when = new Date(data.scheduledAt);
        if (when <= new Date()) throw createError('VALIDATION_ERROR', 'scheduledAt must be in the future');
        data.status = 'scheduled';
      } else {
        data.status = 'draft';
      }

      const errors = validateEntity(data, SocialShare.validationRules);
      if (errors.length) throw createError('VALIDATION_ERROR', 'Invalid share data', errors);

      const share = new SocialShare(data);
      await share.save();

      await logAuditEvent({
        userId: req.user.id, action: 'CREATE_SHARE',
        details: `Created share on ${share.platform}`, resourceId: share.id, resourceType: 'socialShare'
      });

      if (share.status === 'scheduled') {
        await enqueueScheduledShare(share, req.user.id);
      }

      broadcastShareUpdate(share, 'create', req.user.id);
      return { share };
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

// PUT /api/shares/:id
exports.updateShare = async (req, res, next) => {
  try {
    const result = await executeTransaction(async () => {
      const share = req.resource;
      const data = { ...share };

      // Prevent userId changes
      if (req.body.userId && req.body.userId !== req.user.id) {
        await logAuditEvent({
          userId: req.user.id, action: 'SECURITY_WARNING',
          details: `Attempted to change userId`, resourceId: share.id, resourceType: 'socialShare'
        });
      }
      delete req.body.userId;

      // Merge allowed fields
      ['content','platform','scheduledAt'].forEach(k => {
        if (req.body[k] !== undefined) data[k] = req.body[k];
      });
      data.userId = req.user.id;

      // Scheduling logic
      const wasScheduled = share.status === 'scheduled';
      if (req.body.scheduledAt) {
        const when = new Date(data.scheduledAt);
        if (when <= new Date()) throw createError('VALIDATION_ERROR','scheduledAt must be in the future');
        data.status = 'scheduled';
      } else if (req.body.scheduledAt === null && wasScheduled) {
        data.status = 'draft';
      }

      const errors = validateEntity(data, SocialShare.validationRules);
      if (errors.length) throw createError('VALIDATION_ERROR','Invalid share data',errors);

      Object.assign(share, data);
      await share.save();

      if (wasScheduled && data.status === 'draft') {
        await removeFromScheduleQueue(share.id);
      } else if (data.status === 'scheduled') {
        await enqueueScheduledShare(share, req.user.id);
      }

      await logAuditEvent({
        userId: req.user.id, action: 'UPDATE_SHARE',
        details: `Updated share on ${share.platform}`, resourceId: share.id, resourceType: 'socialShare'
      });

      broadcastShareUpdate(share, 'update', req.user.id);
      return { share };
    });

    res.status(200).json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

// DELETE /api/shares/:id
exports.deleteShare = async (req, res, next) => {
  try {
    await executeTransaction(async () => {
      const share = req.resource;
      if (share.status === 'scheduled') {
        await removeFromScheduleQueue(share.id);
      }
      await SocialShare.deleteById(share.id);

      await logAuditEvent({
        userId: req.user.id, action: 'DELETE_SHARE',
        details: `Deleted share on ${share.platform}`, resourceId: share.id, resourceType: 'socialShare'
      });

      broadcastShareUpdate({ id: share.id, userId: share.userId }, 'delete', req.user.id);
    });

    res.status(204).send();
  } catch (err) { next(err); }
};
