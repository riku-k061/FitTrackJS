const express = require('express');
const router = express.Router();
const stravaConnectorController = require('../controllers/stravaConnectorController');
const jwtMiddleware = require('../middleware/authMiddleware');

// OAuth routes
router.get('/connectors/strava/auth', stravaConnectorController.initiateAuth);
router.get('/connectors/strava/callback', stravaConnectorController.handleCallback);

// System-wide sync (no auth required for system operations)
router.post('/connectors/strava/sync-all', stravaConnectorController.syncAll);

// Individual connector operations (no auth required, connector ID is the security)
router.get('/connectors/:id/test', stravaConnectorController.testConnection);
router.post('/connectors/:id/sync', stravaConnectorController.initialSync);
router.patch('/connectors/:id/sync', stravaConnectorController.incrementalSync);

module.exports = router; 