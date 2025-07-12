const express = require('express');
const {
  getWorkouts,
  getWorkout,
  createNewWorkout,
  updateExistingWorkout,
  removeWorkout
} = require('../controllers/workoutController');
const { getUserStats } = require('../controllers/workoutStatsController');
const authenticate = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate);

router.get('/', getWorkouts);

// Stats must precede `/:id`
router.get('/stats/:userId', getUserStats);

router.get('/:id', getWorkout);
router.post('/', createNewWorkout);
router.put('/:id', updateExistingWorkout);
router.delete('/:id', removeWorkout);

module.exports = router;
