// models/fitnessGoalModel.js
const { v4: uuidv4 } = require('uuid');
const cache = require('../utils/goalsCacheUtils');
const userService = require('../utils/userService');

const validateGoal = async (g) => {
  const errs = [];
  const types = ['weight_loss','muscle_gain','endurance'];

  if (!g.userId) errs.push('User ID is required');
  else if (!await userService.exists(g.userId)) errs.push('User does not exist');

  if (!g.goalType) errs.push('Goal type is required');
  else if (!types.includes(g.goalType)) errs.push(`Goal type must be one of: ${types.join(', ')}`);

  if (g.targetValue == null) errs.push('Target value is required');
  else if (typeof g.targetValue!=='number' || isNaN(g.targetValue)) errs.push('Target value must be a number');

  if (g.currentValue != null && (typeof g.currentValue!=='number'||isNaN(g.currentValue)))
    errs.push('Current value must be a number');

  if (!g.startDate) errs.push('Start date is required');
  if (!g.endDate) errs.push('End date is required');

  if (g.startDate && g.endDate) {
    const s=new Date(g.startDate), e=new Date(g.endDate);
    if (isNaN(s)||isNaN(e)) {
      if (isNaN(s)) errs.push('Invalid start date');
      if (isNaN(e)) errs.push('Invalid end date');
    } else if (s>e) errs.push('Start date cannot be after end date');
  }

  return errs;
};

const getAllGoals     = () => cache.getAll();
const getGoalsByUser  = (uid) => cache.filter({ userId:uid, limit:1000, offset:0 }).then(r=>r.goals);
const getGoalById     = (id) => cache.getById(id);
const filterGoals     = (params) => cache.filter(params);

const createGoal = async (data) => {
  const g = {
    id: uuidv4(),
    ...data,
    targetValue: Number(data.targetValue),
    currentValue: data.currentValue != null ? Number(data.currentValue) : 0,
    createdAt: new Date().toISOString()
  };
  await cache.add(g);
  return g;
};

const updateGoal = async (id,data) => {
  const old = await cache.getById(id);
  if (!old) return null;
  const upd = {
    ...old,
    ...data,
    targetValue: data.targetValue!=null?Number(data.targetValue):old.targetValue,
    currentValue:data.currentValue!=null?Number(data.currentValue):old.currentValue,
    updatedAt:new Date().toISOString()
  };
  return cache.update(id, upd);
};

const deleteGoal = (id) => cache.remove(id);

const getActiveGoalsByUserId = async (userId) => {
  const allGoals = await cache.getAll();
  return allGoals.filter(goal => 
    goal.userId === userId && 
    goal.status !== 'completed' && 
    goal.status !== 'cancelled'
  );
};

module.exports = {
  validateGoal,
  getAllGoals,
  getGoalsByUserId: getGoalsByUser,
  getActiveGoalsByUserId,
  getGoalById,
  filterGoals,
  createGoal,
  updateGoal,
  deleteGoal
};
