const { getUserWorkoutStats } = require('../utils/workoutStatsUtils');

async function getUserStats(req, res, next) {
  try {
    const { userId } = req.params;
    const forceRefresh = req.query.refresh === 'true';

    if (userId !== req.user.sub && !['admin', 'coach'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Not authorized to view these statistics.' });
    }

    const stats = await getUserWorkoutStats(userId, forceRefresh);
    res.json(stats);
  } catch (err) {
    if (err.message.includes('does not exist')) {
      return res.status(404).json({ message: err.message });
    }
    next(err);
  }
}

module.exports = { getUserStats };
