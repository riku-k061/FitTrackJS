const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

// overall analytics + goal progress
router.get('/:userId', analyticsController.getUserAnalytics);

// daily analytics for a single day
router.get('/:userId/daily', analyticsController.getDailyAnalytics);

// last-7-days trends
router.get('/:userId/weekly', analyticsController.getWeeklyTrends);

// just goal progress
router.get('/:userId/goals', analyticsController.getGoalProgress);

// basic anomaly detection (caloriesBurned)
router.get('/:userId/anomalies', analyticsController.getAnomalies);

// multimetric anomaly detection
router.get('/:userId/anomalies/multimetric', analyticsController.getMultimetricAnomalies);

module.exports = router;
