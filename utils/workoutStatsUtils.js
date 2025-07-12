const { readDataFile } = require('./fileUtils');
const { userExists } = require('./userCacheUtils');

// Constants
const WORKOUT_FILE = 'data/workouts.json';
const STATS_CACHE = new Map(); // userId -> { timestamp, stats }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

function calculateStatsFromWorkouts(workouts) {
  const weeklyStats = {};
  const exerciseTypeStats = {};
  let totalCaloriesBurned = 0;
  let totalDuration = 0;
  let workoutCount = 0;

  workouts.forEach(workout => {
    const date = new Date(workout.date);
    if (isNaN(date.getTime())) return;
    const weekNumber = getWeekNumber(date);
    const year = date.getFullYear();
    const weekKey = `${year}-W${weekNumber}`;

    if (!weeklyStats[weekKey]) {
      weeklyStats[weekKey] = {
        year,
        week: weekNumber,
        startDate: getStartDateOfWeek(year, weekNumber),
        endDate: getEndDateOfWeek(year, weekNumber),
        workouts: 0,
        duration: 0,
        caloriesBurned: 0,
        byExerciseType: {}
      };
    }

    const exerciseType = workout.exerciseType || 'unknown';
    if (!weeklyStats[weekKey].byExerciseType[exerciseType]) {
      weeklyStats[weekKey].byExerciseType[exerciseType] = {
        workouts: 0,
        duration: 0,
        caloriesBurned: 0
      };
    }
    if (!exerciseTypeStats[exerciseType]) {
      exerciseTypeStats[exerciseType] = {
        workouts: 0,
        duration: 0,
        caloriesBurned: 0
      };
    }

    const duration = parseInt(workout.duration, 10) || 0;
    const caloriesBurned = parseInt(workout.caloriesBurned, 10) || 0;

    weeklyStats[weekKey].workouts += 1;
    weeklyStats[weekKey].duration += duration;
    weeklyStats[weekKey].caloriesBurned += caloriesBurned;

    weeklyStats[weekKey].byExerciseType[exerciseType].workouts += 1;
    weeklyStats[weekKey].byExerciseType[exerciseType].duration += duration;
    weeklyStats[weekKey].byExerciseType[exerciseType].caloriesBurned += caloriesBurned;

    exerciseTypeStats[exerciseType].workouts += 1;
    exerciseTypeStats[exerciseType].duration += duration;
    exerciseTypeStats[exerciseType].caloriesBurned += caloriesBurned;

    totalDuration += duration;
    totalCaloriesBurned += caloriesBurned;
    workoutCount += 1;
  });

  const weeks = Object.values(weeklyStats).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.week - a.week;
  });

  const avgCaloriesPerWorkout = workoutCount > 0 ? totalCaloriesBurned / workoutCount : 0;
  const avgDurationPerWorkout = workoutCount > 0 ? totalDuration / workoutCount : 0;
  const trends = calculateTrends(weeks);

  return {
    summary: {
      totalWorkouts: workoutCount,
      totalDuration,
      totalCaloriesBurned,
      avgCaloriesPerWorkout,
      avgDurationPerWorkout
    },
    weeks,
    byExerciseType: exerciseTypeStats,
    trends
  };
}

function calculateTrends(weeks) {
  if (weeks.length < 2) return { durationTrend: 0, caloriesTrend: 0 };
  const recentWeeks = weeks.slice(0, Math.min(4, weeks.length));
  let durationDiffSum = 0;
  let caloriesDiffSum = 0;
  let comparisons = 0;

  for (let i = 0; i < recentWeeks.length - 1; i++) {
    const current = recentWeeks[i];
    const previous = recentWeeks[i + 1];
    durationDiffSum += current.duration - previous.duration;
    caloriesDiffSum += current.caloriesBurned - previous.caloriesBurned;
    comparisons++;
  }

  return {
    durationTrend: comparisons > 0 ? durationDiffSum / comparisons : 0,
    caloriesTrend: comparisons > 0 ? caloriesDiffSum / comparisons : 0
  };
}

function getWeekNumber(d) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getStartDateOfWeek(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dayOfWeek = simple.getDay();
  const start = new Date(simple);
  if (dayOfWeek <= 4) start.setDate(simple.getDate() - simple.getDay() + 1);
  else start.setDate(simple.getDate() + 8 - simple.getDay());
  return start.toISOString().split('T')[0];
}

function getEndDateOfWeek(year, week) {
  const start = new Date(getStartDateOfWeek(year, week));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end.toISOString().split('T')[0];
}

async function getUserWorkoutStats(userId, forceRefresh = false) {
  const valid = await userExists(userId);
  if (!valid) throw new Error(`User with id ${userId} does not exist`);

  const now = Date.now();
  const cached = STATS_CACHE.get(userId);
  if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL) {
    return cached.stats;
  }

  const all = await readDataFile(WORKOUT_FILE);
  const userWorkouts = all.filter(w => w.userId === userId);
  const stats = calculateStatsFromWorkouts(userWorkouts);

  STATS_CACHE.set(userId, { timestamp: now, stats });
  return stats;
}

function invalidateStatsCache(userId = null) {
  if (userId) STATS_CACHE.delete(userId);
  else STATS_CACHE.clear();
}

// Invalidate on workout data change
const { fileCache } = require('./fileUtils');
if (typeof fileCache.onUpdate === 'function') {
  fileCache.onUpdate(WORKOUT_FILE, () => invalidateStatsCache());
}

module.exports = { getUserWorkoutStats, invalidateStatsCache };
