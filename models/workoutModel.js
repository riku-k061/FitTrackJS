// models/workoutModel.js
const { v4: uuidv4 } = require('uuid');
const { validateWorkout } = require('../utils/validation');

class WorkoutLog {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.date = data.date || new Date().toISOString();
    this.exerciseType = data.exerciseType.toLowerCase();
    this.duration = data.duration !== undefined ? parseInt(data.duration, 10) : 0;
    this.caloriesBurned = data.caloriesBurned !== undefined ? parseInt(data.caloriesBurned, 10) : 0;
    this.reps = data.reps !== undefined ? parseInt(data.reps, 10) : 0;
    this.sets = data.sets !== undefined ? parseInt(data.sets, 10) : 0;
  }

  static async create(data) {
    const validationResult = await validateWorkout(data);
    if (!validationResult.isValid) {
      throw new Error(`Invalid workout data: ${validationResult.errors.join(', ')}`);
    }
    return new WorkoutLog(data);
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      date: this.date,
      exerciseType: this.exerciseType,
      duration: this.duration,
      caloriesBurned: this.caloriesBurned,
      reps: this.reps,
      sets: this.sets
    };
  }
}

module.exports = { WorkoutLog };
