require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  dataPath: './data',
  saltRounds: parseInt(process.env.SALT_ROUNDS || '10', 10),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'default_access_secret_dev_only',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_dev_only',
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d'
  }
};
