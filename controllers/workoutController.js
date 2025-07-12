const {
  getWorkouts,
  getWorkoutById,
  createWorkout,
  updateWorkout,
  deleteWorkout
} = require('../utils/workoutUtils');

async function getWorkoutsWithFilters(req, res, next) {
  try {
    const {
      userId, exerciseType, startDate, endDate,
      limit, offset, sort, order, includeUser='true'
    } = req.query;
    const opts = {
      userId,
      exerciseType,
      startDate,
      endDate,
      limit: limit?parseInt(limit,10):10,
      offset: offset?parseInt(offset,10):0,
      sort, order,
      includeUser: includeUser==='true'
    };

    // authorization
    if (userId && userId!==req.user.id && !['admin','coach'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (!userId && !['admin','coach'].includes(req.user.role)) {
      opts.userId = req.user.id;
    }

    const result = await getWorkouts(opts);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getWorkout(req, res, next) {
  try {
    const { id } = req.params;
    const { includeUser='true' } = req.query;
    const wk = await getWorkoutById(id, includeUser==='true');
    if (!wk) return res.status(404).json({ message: 'Not found' });
    if (wk.userId!==req.user.id && !['admin','coach'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    res.json(wk);
  } catch (err) { next(err); }
}

async function createNewWorkout(req, res, next) {
  try {
    const data = { ...req.body, userId: req.user.id };
    const wk = await createWorkout(data);
    res.status(201).json(wk);
  } catch (err) { next(err); }
}

async function updateExistingWorkout(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await getWorkoutById(id);
    if (!existing) return res.status(404).json({ message:'Not found' });
    if (existing.userId!==req.user.id && req.user.role!=='admin') {
      return res.status(403).json({ message:'Not authorized' });
    }
    const wk = await updateWorkout(id, { ...req.body, userId: existing.userId });
    res.json(wk);
  } catch (err) { next(err); }
}

async function removeWorkout(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await getWorkoutById(id);
    if (!existing) return res.status(404).json({ message:'Not found' });
    if (existing.userId!==req.user.id && req.user.role!=='admin') {
      return res.status(403).json({ message:'Not authorized' });
    }
    await deleteWorkout(id, req.user.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = {
  getWorkouts: getWorkoutsWithFilters,
  getWorkout,
  createNewWorkout,
  updateExistingWorkout,
  removeWorkout
};
