// routes/fitnessGoalRoutes.js
const express = require('express');
const ctrl    = require('../controllers/fitnessGoalController');
const { authenticate } = require('../middleware/authMiddleware');
const router  = express.Router();

router.use(authenticate);

/**
 * GET /api/goals
 * @query userId, goalType, status(active|inactive), limit, offset
 */
router.get('/', ctrl.getGoals);
router.get('/:id', ctrl.getGoalById);
router.post('/',    ctrl.createGoal);
router.put('/:id',  ctrl.updateGoal);
router.delete('/:id', ctrl.deleteGoal);

module.exports = router;
