const { v4: uuidv4 } = require('uuid');
const { validateData } = require('../utils/validation');
const fileService = require('../utils/fileService');
const { getNutritionLogs } = require('../utils/indexingUtils');

const COLL = 'nutritionLogs';

const nutritionLogSchema = {
  userId:  { type:'string', required:true },
  date:    { type:'string', required:true, pattern:'^\\d{4}-\\d{2}-\\d{2}$' },
  mealType:{ type:'string', required:true, enum:['breakfast','lunch','dinner','snack'] },
  calories:{ type:'number', required:true, min:0 },
  protein: { type:'number', required:true, min:0 },
  carbs:   { type:'number', required:true, min:0 },
  fat:     { type:'number', required:true, min:0 }
};

async function getAllNutritionLogs(filters, limit, offset) {
  return getNutritionLogs(filters, limit, offset);
}

async function getNutritionLogById(id) {
  return fileService.getById(COLL, id);
}

async function getNutritionLogsByUserId(userId) {
  const all = await fileService.getAll(COLL);
  return all.filter(l=>l.userId===userId);
}

async function createNutritionLog(data) {
  const errs = validateData(data, nutritionLogSchema);
  if (errs.length) throw new Error(`Validation error: ${errs.join(', ')}`);
  const log = { id:uuidv4(), ...data, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
  return fileService.create(COLL, log);
}

async function updateNutritionLog(id,data) {
  const errs = validateData(data, nutritionLogSchema);
  if (errs.length) throw new Error(`Validation error: ${errs.join(', ')}`);
  return fileService.update(COLL, id, data);
}

async function deleteNutritionLog(id) {
  return fileService.delete(COLL, id);
}

module.exports = {
  getAllNutritionLogs,
  getNutritionLogById,
  getNutritionLogsByUserId,
  createNutritionLog,
  updateNutritionLog,
  deleteNutritionLog,
  nutritionLogSchema
};
