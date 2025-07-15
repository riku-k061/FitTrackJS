const express = require('express');
const authRoutes    = require('./routes/authRoutes');
const userRoutes    = require('./routes/userRoutes');
const workoutRoutes = require('./routes/workoutRoutes');
const nutritionRoutes = require('./routes/nutritionRoutes');
const errorHandler = require('./middleware/errorHandler');
const { buildIndexes } = require('./utils/indexingUtils');

const app = express();
app.use(express.json());

// build workout indexes on startup
(async()=>{
  try {
    // Skip index building in test environment
    if (process.env.NODE_ENV !== 'test') {
      await buildIndexes('data/workouts.json',['userId','exerciseType','date']);
      console.log('Workout indexes built');
    }
  } catch(e){
    console.error('Index build error',e);
  }
})();

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/workouts', workoutRoutes);
app.use('/api/nutrition', nutritionRoutes);

app.use(errorHandler);
module.exports = app;
