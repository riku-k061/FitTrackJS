const { userExists } = require('./userCacheUtils');
const validExerciseTypes = ['cardio','strength','flexibility'];
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

async function validateWorkout(workout) {
  const errors = [];
  if (!workout.userId) {
    errors.push('UserId is required');
  } else {
    const exists = await userExists(workout.userId);
    if (!exists) errors.push(`User ${workout.userId} does not exist`);
  }

  if (!workout.exerciseType) {
    errors.push('Exercise type is required');
  } else if (!validExerciseTypes.includes(workout.exerciseType.toLowerCase())) {
    errors.push(`Exercise type must be one of: ${validExerciseTypes.join(', ')}`);
  }

  [['duration','positive integer'],
   ['caloriesBurned','positive integer'],
   ['reps','non-negative integer'],
   ['sets','non-negative integer']
  ].forEach(([field, desc]) => {
    if (workout[field] !== undefined) {
      const num = Number(workout[field]);
      if (!Number.isInteger(num)) {
        errors.push(`${field} must be an integer`);
      } else if ((field==='reps' || field==='sets') ? num<0 : num<=0) {
        errors.push(`${field} must be a ${desc}`);
      }
    }
  });

  if (workout.exerciseType?.toLowerCase()==='strength' &&
      (!(workout.reps) || !(workout.sets))) {
    errors.push('Reps and sets are required for strength workouts');
  }

  return { isValid: errors.length===0, errors };
}

function validateUser(userData, existingUsers = [], currentUserId = null) {
  const errors = [];

  if (!userData.name?.trim()) {
    errors.push('Name is required');
  }

  if (!userData.email) {
    errors.push('Email is required');
  } else if (!emailRegex.test(userData.email)) {
    errors.push('Invalid email format');
  } else {
    const exists = existingUsers.some(u =>
      u.email === userData.email.toLowerCase().trim() && u.id !== currentUserId
    );
    if (exists) errors.push('Email is already in use');
  }

  if (!currentUserId && !userData.password) {
    errors.push('Password is required');
  } else if (userData.password && !passwordRegex.test(userData.password)) {
    errors.push('Password must be at least 8 characters and include letters, numbers, and special characters');
  }

  if (userData.height != null) {
    const h = Number(userData.height);
    if (isNaN(h)) errors.push('Height must be a number');
    else if (h < 30 || h > 250) errors.push('Height must be between 30cm and 250cm');
  }

  if (userData.weight != null) {
    const w = Number(userData.weight);
    if (isNaN(w)) errors.push('Weight must be a number');
    else if (w < 20 || w > 500) errors.push('Weight must be between 20kg and 500kg');
  }

  if (userData.fitnessGoals != null) {
    if (!Array.isArray(userData.fitnessGoals)) {
      errors.push('Fitness goals must be an array');
    } else if (userData.fitnessGoals.some(g => typeof g !== 'string')) {
      errors.push('All fitness goals must be strings');
    }
  }

  return { isValid: errors.length === 0, errors };
}

module.exports = { validateUser, validateWorkout };
