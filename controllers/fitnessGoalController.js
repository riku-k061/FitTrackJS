// controllers/fitnessGoalController.js
const model    = require('../models/fitnessGoalModel');
const userSvc  = require('../utils/userService');
const { createError } = require('../utils/errorUtils');

async function enrich(goal) {
  if (!goal) return null;
  const user = await userSvc.getPublic(goal.userId);
  return { ...goal, user };
}

async function enrichAll(arr) {
  const map = new Map();
  for (const g of arr) {
    if (!map.has(g.userId)) {
      map.set(g.userId, await userSvc.getPublic(g.userId));
    }
  }
  return arr.map(g => ({ ...g, user: map.get(g.userId) }));
}

exports.getGoals = async (req,res,next) => {
  try {
    const { userId, goalType, status, limit=10, offset=0 } = req.query;
    const l = parseInt(limit), o = parseInt(offset);
    if (isNaN(l)||l<1||l>100) throw createError(400,'Limit must be 1–100');
    if (isNaN(o)||o<0) throw createError(400,'Offset must be ≥0');

    const { goals, pagination } = await model.filterGoals({ userId, goalType, status, limit:l, offset:o });
    const data = await enrichAll(goals);
    res.json({ success:true, data, pagination });
  } catch(err){ next(err) }
};

exports.getGoalById = async (req,res,next) => {
  try {
    const g = await model.getGoalById(req.params.id);
    if (!g) throw createError(404,'Fitness goal not found');
    res.json({ success:true, data: await enrich(g) });
  } catch(err){ next(err) }
};

exports.createGoal = async (req,res,next) => {
  try {
    const errs = await model.validateGoal(req.body);
    if (errs.length) throw createError(400,'Validation error',{ errors:errs });

    const g = await model.createGoal(req.body);
    res.status(201).json({ success:true, data: await enrich(g) });
  } catch(err){ next(err) }
};

exports.updateGoal = async (req,res,next) => {
  try {
    const old = await model.getGoalById(req.params.id);
    if (!old) throw createError(404,'Fitness goal not found');

    if (req.body.userId && req.body.userId!==old.userId && !await userSvc.exists(req.body.userId))
      throw createError(400,'User does not exist');

    const g = await model.updateGoal(req.params.id, req.body);
    res.json({ success:true, data: await enrich(g) });
  } catch(err){ next(err) }
};

exports.deleteGoal = async (req,res,next) => {
  try {
    const old = await model.getGoalById(req.params.id);
    if (!old) throw createError(404,'Fitness goal not found');
    await model.deleteGoal(req.params.id);
    res.json({ success:true, message:'Fitness goal deleted successfully' });
  } catch(err){ next(err) }
};
