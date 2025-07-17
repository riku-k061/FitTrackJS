const moment = require('moment-timezone');
const workoutModel = require('../models/workoutModel');
const nutritionModel = require('../models/nutritionModel');
const fitnessGoalModel = require('../models/fitnessGoalModel');
const userModel = require('../models/userModel');
const tz = require('../utils/timezoneUtils');
const stats = require('../utils/statisticsUtils');

/**
 * Helper: calculate progress for a list of goals.
 */
const calculateGoalProgress = (goals) =>
  goals.map(goal => {
    const pct = (goal.currentValue / goal.targetValue) * 100;
    return {
      id: goal.id,
      goalType: goal.goalType,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      startDate: goal.startDate,
      endDate: goal.endDate,
      progress: Math.min(Math.round(pct * 10) / 10, 100),
      completed: pct >= 100
    };
  });

/**
 * GET /api/analytics/:userId
 * Overall analytics + goal progress.
 */
exports.getUserAnalytics = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    const user = await userModel.getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const tzName = user.timezone || 'UTC';

    // Build dateFilter
    const dateFilter = {};
    if (startDate) dateFilter.start = tz.getUserDayBoundaries(startDate, tzName).startTime;
    if (endDate)   dateFilter.end   = tz.getUserDayBoundaries(endDate,   tzName).endTime;

    const [workouts, logs, activeGoals] = await Promise.all([
      workoutModel.getWorkoutsByUserId(userId, dateFilter),
      nutritionModel.getNutritionLogsByUserId(userId, dateFilter),
      fitnessGoalModel.getActiveGoalsByUserId(userId)
    ]);

    const totalWorkoutDuration = workouts.reduce((s,w) => s + (w.duration||0), 0);
    const totalCaloriesIntake  = logs.reduce((s,l) => s + (l.calories||0), 0);
    const totalCaloriesBurned  = workouts.reduce((s,w) => s + (w.caloriesBurned||0), 0);

    // Group by local day
    const wByDay = tz.groupByUserLocalDay(workouts, 'startTime', tzName);
    const nByDay = tz.groupByUserLocalDay(logs,     'timestamp', tzName);
    const allDays = Array.from(new Set([...Object.keys(wByDay), ...Object.keys(nByDay)])).sort();

    const dailyTotals = allDays.map(day => ({
      date: day,
      workoutDuration: (wByDay[day]||[]).reduce((s,w)=>s+(w.duration||0),0),
      caloriesIntake:  (nByDay[day]||[]).reduce((s,n)=>s+(n.calories||0),0),
      caloriesBurned:  (wByDay[day]||[]).reduce((s,w)=>s+(w.caloriesBurned||0),0)
    }));

    res.json({
      success: true,
      data: {
        totalWorkoutDuration,
        totalCaloriesIntake,
        totalCaloriesBurned,
        dailyTotals,
        goalProgress: calculateGoalProgress(activeGoals)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/:userId/daily?date=YYYY-MM-DD
 * Analytics for a single day + goal progress.
 */
exports.getDailyAnalytics = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { date } = req.query;
    const user = await userModel.getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const tzName = user.timezone || 'UTC';

    const { startTime, endTime } = tz.getUserDayBoundaries(date || new Date(), tzName);
    const [workouts, logs, activeGoals] = await Promise.all([
      workoutModel.getWorkoutsByUserId(userId, { start: startTime, end: endTime }),
      nutritionModel.getNutritionLogsByUserId(userId, { start: startTime, end: endTime }),
      fitnessGoalModel.getActiveGoalsByUserId(userId)
    ]);

    const workoutDuration = workouts.reduce((s,w) => s + (w.duration||0), 0);
    const caloriesIntake  = logs.reduce((s,l) => s + (l.calories||0), 0);
    const caloriesBurned  = workouts.reduce((s,w) => s + (w.caloriesBurned||0), 0);

    res.json({
      success: true,
      data: {
        date: moment(date || new Date()).tz(tzName).format('YYYY-MM-DD'),
        workoutDuration,
        caloriesIntake,
        caloriesBurned,
        netCalories: caloriesIntake - caloriesBurned,
        goalProgress: calculateGoalProgress(await fitnessGoalModel.getActiveGoalsByUserId(userId))
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/:userId/weekly
 * Last 7 days trends + goal progress.
 */
exports.getWeeklyTrends = async (req, res, next) => {
  try {
    const { userId } = req.params;
    let { referenceDate } = req.query;
    const user = await userModel.getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const tzName = user.timezone || 'UTC';
    referenceDate = referenceDate ? new Date(referenceDate) : new Date();

    const { startTime, endTime, startDay, endDay } =
      tz.getLastNDaysBoundaries(7, referenceDate, tzName);
    const [workouts, logs, activeGoals] = await Promise.all([
      workoutModel.getWorkoutsByUserId(userId, { start: startTime, end: endTime }),
      nutritionModel.getNutritionLogsByUserId(userId, { start: startTime, end: endTime }),
      fitnessGoalModel.getActiveGoalsByUserId(userId)
    ]);

    const days = tz.generateLastNDaysArray(7, referenceDate, tzName);
    const wByDay = tz.groupByUserLocalDay(workouts, 'startTime', tzName);
    const nByDay = tz.groupByUserLocalDay(logs,     'timestamp', tzName);

    const dailyTrends = days.map(d => ({
      date: d,
      workoutDuration: (wByDay[d]||[]).reduce((s,w)=>s+(w.duration||0),0),
      caloriesIntake:  (nByDay[d]||[]).reduce((s,n)=>s+(n.calories||0),0),
      caloriesBurned:  (wByDay[d]||[]).reduce((s,w)=>s+(w.caloriesBurned||0),0),
      workoutCount:    (wByDay[d]||[]).length
    }));

    const totals = dailyTrends.reduce((acc, day) => {
      acc.workoutDuration += day.workoutDuration;
      acc.caloriesIntake  += day.caloriesIntake;
      acc.caloriesBurned  += day.caloriesBurned;
      acc.workouts        += day.workoutCount;
      return acc;
    }, { workoutDuration: 0, caloriesIntake: 0, caloriesBurned: 0, workouts: 0 });

    res.json({
      success: true,
      data: {
        periodBoundaries: { startDate: startDay, endDate },
        totals,
        averages: {
          workoutDuration: totals.workoutDuration / 7,
          caloriesIntake:  totals.caloriesIntake  / 7,
          caloriesBurned:  totals.caloriesBurned  / 7,
          workoutsPerDay:  totals.workouts        / 7
        },
        dailyTrends,
        goalProgress: calculateGoalProgress(activeGoals)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/:userId/goals
 * Just goal progress for quick checks.
 */
exports.getGoalProgress = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await userModel.getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const active = await fitnessGoalModel.getActiveGoalsByUserId(userId);
    res.json({ success: true, data: { goalProgress: calculateGoalProgress(active) } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/:userId/anomalies?threshold=2&days=30
 * Detect days where caloriesBurned deviates > threshold σ from the N-day mean.
 */
exports.getAnomalies = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const t = parseFloat(req.query.threshold) || 2.0;
    const d = parseInt(req.query.days) || 30;
    const user = await userModel.getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const tzName = user.timezone || 'UTC';
    const { startTime, endTime } = tz.getLastNDaysBoundaries(d, new Date(), tzName);
    const workouts = await workoutModel.getWorkoutsByUserId(userId, { start: startTime, end: endTime });
    const days = tz.generateLastNDaysArray(d, new Date(), tzName);
    const byDay = tz.groupByUserLocalDay(workouts, 'startTime', tzName);
    const daily = days.map(day => ({
      date: day,
      caloriesBurned: (byDay[day]||[]).reduce((s,w)=>s+(w.caloriesBurned||0),0)
    }));
    const vals = daily.map(d => d.caloriesBurned);
    const anomalies = stats.detectAnomalies(vals, vals, t);
    const analysis = daily.map((entry,i) => ({
      ...entry,
      deviation: anomalies[i].deviation,
      isAnomaly: anomalies[i].isAnomaly
    }));
    const mean = stats.calculateMean(vals);
    const sd   = stats.calculateStandardDeviation(vals);
    res.json({
      success: true,
      data: {
        statistics: { mean, standardDeviation: sd, anomalyThreshold: sd * t, threshold: t, daysAnalyzed: d },
        anomalyCount: analysis.filter(a => a.isAnomaly).length,
        anomalies: analysis.filter(a => a.isAnomaly),
        allDaysAnalysis: analysis
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/:userId/anomalies/multimetric?metrics=caloriesBurned,workoutDuration&threshold=2&days=30
 * Detect anomalies across multiple metrics simultaneously.
 */
exports.getMultimetricAnomalies = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const t = parseFloat(req.query.threshold) || 2.0;
    const d = parseInt(req.query.days)       || 30;
    const metrics = (req.query.metrics || '').split(',');
    const user = await userModel.getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const tzName = user.timezone || 'UTC';
    const { startTime, endTime } = tz.getLastNDaysBoundaries(d, new Date(), tzName);
    const [workouts, nutrition] = await Promise.all([
      workoutModel.getWorkoutsByUserId(userId, { start: startTime, end: endTime }),
      nutritionModel.getNutritionLogsByUserId(userId, { start: startTime, end: endTime })
    ]);

    const days = tz.generateLastNDaysArray(d, new Date(), tzName);
    const wByDay = tz.groupByUserLocalDay(workouts, 'startTime', tzName);
    const nByDay = tz.groupByUserLocalDay(nutrition, 'timestamp', tzName);

    // Build dailyMetrics array
    const dailyMetrics = days.map(day => ({
      date: day,
      caloriesBurned: (wByDay[day]||[]).reduce((s,w)=>s+(w.caloriesBurned||0),0),
      workoutDuration: (wByDay[day]||[]).reduce((s,w)=>s+(w.duration||0),0),
      workoutCount:    (wByDay[day]||[]).length,
      caloriesIntake:  (nByDay[day]||[]).reduce((s,n)=>s+(n.calories||0),0)
    }));

    // Detect per‑metric anomalies
    const metricAnomalies = {};
    const allAnomalyDays = new Set();
    metrics.forEach(metric => {
      if (dailyMetrics[0] && metric in dailyMetrics[0]) {
        const vals = dailyMetrics.map(dm => dm[metric]);
        const det = stats.detectAnomalies(vals, vals, t);
        metricAnomalies[metric] = dailyMetrics
          .map((dm,i) => ({ date: dm.date, value: vals[i], deviation: det[i].deviation, isAnomaly: det[i].isAnomaly }))
          .filter(x => x.isAnomaly);
        metricAnomalies[metric].forEach(x => allAnomalyDays.add(x.date));
      }
    });

    const combined = dailyMetrics
      .filter(dm => allAnomalyDays.has(dm.date))
      .map(dm => ({
        ...dm,
        anomalousMetrics: metrics.filter(m =>
          (metricAnomalies[m]||[]).some(a => a.date === dm.date)
        )
      }));

    res.json({
      success: true,
      data: {
        anomalyCount: combined.length,
        anomalies: combined,
        metricSpecificAnomalies: metricAnomalies,
        analysisParameters: { threshold: t, daysAnalyzed: d, metricsAnalyzed: metrics }
      }
    });
  } catch (err) {
    next(err);
  }
};
