const express = require('express');
const auth     = require('../middleware/authMiddleware');
const ctrl     = require('../controllers/nutritionController');
const statsCtr = require('../controllers/nutritionStatsController');
const router   = express.Router();

router.use(auth.protect);

// /api/nutrition
router.route('/')
  .get(ctrl.list)
  .post(ctrl.create);

// /api/nutrition/:id
router.route('/:id')
  .get(ctrl.getOne)
  .put(ctrl.update)
  .delete(ctrl.remove);

// stats endpoints
router.get('/stats/:userId', statsCtr.getNutritionStats);
router.post('/stats/:userId/invalidate', auth.checkOwnership, statsCtr.invalidateStats);

module.exports = router;
