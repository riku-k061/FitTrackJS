const {
  getAllNutritionLogs,
  getNutritionLogById,
  getNutritionLogsByUserId,
  createNutritionLog,
  updateNutritionLog,
  deleteNutritionLog
} = require('../models/nutritionModel');
const fileService = require('../utils/fileService');
const { createErrorResponse } = require('../utils/errorUtils');

async function listNutrition(req,res) {
  try {
    const filters = {
      userId: req.query.userId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      mealType: req.query.mealType
    };
    const limit = Math.min(Math.max(+req.query.limit||10,1),100);
    const offset = Math.max(+req.query.offset||0,0);
    const result = await getAllNutritionLogs(filters,limit,offset);
    return res.json(result);
  } catch(e){ return createErrorResponse(res,500,e.message) }
}

async function getNutrition(req,res) {
  try {
    const log = await getNutritionLogById(req.params.id);
    if (!log) return createErrorResponse(res,404,'Not found');
    return res.json(log);
  } catch(e){ return createErrorResponse(res,500,e.message) }
}

async function getUserNutrition(req,res) {
  try {
    const logs = await getNutritionLogsByUserId(req.params.userId);
    return res.json(logs);
  } catch(e){ return createErrorResponse(res,500,e.message) }
}

async function addNutrition(req,res) {
  try {
    const newLog = await createNutritionLog(req.body);
    return res.status(201).json(newLog);
  } catch(e){
    return e.message.includes('Validation')
      ? createErrorResponse(res,400,e.message)
      : createErrorResponse(res,500,e.message);
  }
}

async function editNutrition(req,res) {
  try {
    const upd = await updateNutritionLog(req.params.id,req.body);
    return res.json(upd);
  } catch(e){
    if (e.message.includes('Validation')) return createErrorResponse(res,400,e.message);
    if (e.message.includes('not found'))   return createErrorResponse(res,404,e.message);
    return createErrorResponse(res,500,e.message);
  }
}

async function removeNutrition(req,res) {
  try {
    await deleteNutritionLog(req.params.id);
    return res.json({ message:'Deleted' });
  } catch(e){
    if (e.message.includes('not found')) return createErrorResponse(res,404,e.message);
    return createErrorResponse(res,500,e.message);
  }
}

async function getPerfMetrics(req,res) {
  return res.json(fileService.getMetrics());
}

async function resetPerfMetrics(req,res) {
  fileService.resetMetrics();
  return res.json({ message: 'Metrics reset' });
}

module.exports = {
  listNutrition,
  getNutrition,
  getUserNutrition,
  addNutrition,
  editNutrition,
  removeNutrition,
  getPerfMetrics,
  resetPerfMetrics
};
