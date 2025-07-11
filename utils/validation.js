const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

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

module.exports = { validateUser };
