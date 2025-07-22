const { calculateNutritionStats } = require('../utils/nutritionStatsUtils');
const { createErrorResponse } = require('../utils/errorUtils');

async function getNutritionStats(req,res) {
  try {
    const userId = req.params.userId;
    const timeframe = ['daily','weekly','monthly'].includes(req.query.timeframe)?req.query.timeframe:'weekly';
    const startDate = req.query.startDate;
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return createErrorResponse(res,400,'startDate must be YYYY-MM-DD');
    }
    const stats = await calculateNutritionStats(userId,timeframe,startDate);
    return res.json(stats);
  } catch(e){
    if (e.message.includes('does not exist')) return createErrorResponse(res,404,e.message);
    return createErrorResponse(res,500,e.message);
  }
}

async function invalidateStats(req,res){
  const { invalidateStatsCache } = require('../utils/nutritionStatsUtils');
  invalidateStatsCache(req.params.userId);
  return res.json({ message:`Cache for ${req.params.userId} invalidated` });
}

module.exports = { getNutritionStats, invalidateStats };
