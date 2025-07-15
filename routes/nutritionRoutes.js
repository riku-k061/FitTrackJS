const express = require('express');
const auth     = require('../middleware/authMiddleware');
const { ownershipMiddleware } = require('../middleware/roleMiddleware');
const ctrl     = require('../controllers/nutritionController');
const statsCtr = require('../controllers/nutritionStatsController');
const router   = express.Router();

router.use(auth);

// /api/nutrition
router.route('/')
  .get(ctrl.listNutrition)
  .post(ctrl.addNutrition);

// /api/nutrition/:id
router.route('/:id')
  .get(ctrl.getNutrition)
  .put(ctrl.editNutrition)
  .delete(ctrl.removeNutrition);

// stats endpoints
router.get('/stats/:userId', statsCtr.getNutritionStats);
router.post('/stats/:userId/invalidate', ownershipMiddleware, statsCtr.invalidateStats);

module.exports = router;
