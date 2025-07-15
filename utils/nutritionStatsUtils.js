const fileService = require('./fileService');
const userCache = require('./userCacheUtils');

// In‐memory cache
const statsCache = { data: {}, lastUpdated: {} };

function hasFresh(key) {
  const TTL = 60*60*1000; // 1h
  return statsCache.data[key] && (Date.now() - statsCache.lastUpdated[key] < TTL);
}

function createEmpty(timeframe) {
  return {
    summary: { totalCalories:0,totalProtein:0,totalCarbs:0,totalFat:0, dailyAvgCalories:0,dailyAvgProtein:0,dailyAvgCarbs:0,dailyAvgFat:0,completeDays:0 },
    byMealType: { breakfast:{calories:0,protein:0,carbs:0,fat:0,count:0}, lunch:{...}, dinner:{...}, snack:{...} },
    periods:{},
    metadata:{ timeframe, startDate:new Date().toISOString().split('T')[0], endDate:new Date().toISOString().split('T')[0], totalLogs:0, generatedAt:new Date().toISOString() }
  };
}

// ... implement calculateDateRange, groupLogsByPeriod, calculatePeriodStats as in Response 2 ...

async function calculateNutritionStats(userId, timeframe='weekly', startDate=null) {
  if (!await userCache.userExists(userId)) throw new Error(`User with id ${userId} does not exist`);
  const key = `${userId}_${timeframe}_${startDate||'current'}`;
  if (hasFresh(key)) return statsCache.data[key];

  const all = await fileService.getAll('nutritionLogs');
  const logs = all.filter(l=>l.userId===userId);
  if (!logs.length) {
    statsCache.data[key] = createEmpty(timeframe);
    statsCache.lastUpdated[userId] = Date.now();
    return statsCache.data[key];
  }

  const { startDateTime, endDateTime, periods } = calculateDateRange(timeframe, startDate);
  const inRange = logs.filter(l => {
    const d = new Date(l.date);
    return d>=startDateTime && d<=endDateTime;
  });
  const byPeriod = groupLogsByPeriod(inRange, timeframe, startDateTime, periods);
  const stats = calculatePeriodStats(byPeriod, periods, timeframe);

  const user = await userCache.getUserById(userId);
  stats.user = { id:userId, name:user?.name||'Unknown', email:user?.email||'Unknown' };
  stats.metadata = { timeframe, startDate: startDateTime.toISOString().split('T')[0], endDate: endDateTime.toISOString().split('T')[0], totalLogs:inRange.length, generatedAt:new Date().toISOString() };

  statsCache.data[key] = stats;
  statsCache.lastUpdated[userId] = Date.now();
  return stats;
}

function invalidateStatsCache(userId) {
  Object.keys(statsCache.data).forEach(k => k.startsWith(userId+'_') && delete statsCache.data[k]);
  delete statsCache.lastUpdated[userId];
}

module.exports = { calculateNutritionStats, invalidateStatsCache };
