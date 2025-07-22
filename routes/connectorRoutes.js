// routes/connectorRoutes.js
const express = require('express');
const router = express.Router();
const connectorController = require('../controllers/connectorController');
const OAuthService = require('../services/oauthService');
const StravaService = require('../services/stravaService');
const { asyncHandler } = require('../utils/errorUtils');

// Standard CRUD
router.get('/', asyncHandler(async (req, res) => {
  res.json(await connectorController.getAll());
}));
router.get('/:id', asyncHandler(async (req, res) => {
  const c = await connectorController.getById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Connector not found' });
  res.json(c);
}));
router.get('/user/:userId', asyncHandler(async (req, res) => {
  const all = await connectorController.getAll();
  res.json(all.filter(c => c.userId === req.params.userId));
}));
router.post('/', asyncHandler(async (req, res) => {
  res.status(201).json(await connectorController.create(req.body));
}));
router.put('/:id', asyncHandler(async (req, res) => {
  const updated = await connectorController.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ message: 'Connector not found' });
  res.json(updated);
}));
router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await connectorController.delete(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Connector not found' });
  res.json({ message: 'Connector deleted successfully' });
}));

// OAuth flows
router.get('/strava/auth', asyncHandler(async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: 'userId is required' });
  res.redirect(OAuthService.getAuthorizationUrl('strava', userId));
}));

router.get('/strava/callback', asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).json({ message: `Authorization error: ${error}` });
  const connector = await OAuthService.handleCallback('strava', code, state);
  res.json({ success: true, message: 'Strava connected', connector });
}));

router.post('/:id/refresh', asyncHandler(async (req, res) => {
  res.json(await OAuthService.refreshTokenWithTransaction(req.params.id));
}));

// Sync endpoints
router.post('/:id/sync', asyncHandler(async (req, res) => {
  const connector = await connectorController.getById(req.params.id);
  if (!connector) return res.status(404).json({ message: 'Connector not found' });
  if (connector.platform !== 'strava') return res.status(400).json({ message: 'Only Strava connectors can be synced' });
  res.json(await StravaService.syncConnector(connector));
}));

router.post('/strava/sync-all', asyncHandler((req, res) => {
  res.json({ message: 'Sync started for all Strava connectors' });
  StravaService.syncAllStravaConnectors().then(results => {
    console.log('Background sync results:', results);
  });
}));

module.exports = router;
