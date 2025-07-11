const { User } = require('../models/userModel');
const {
  generateTokens,
  validateRefreshToken,
  revokeRefreshToken
} = require('../utils/tokenUtils');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const user = await User.verifyCredentials(email, password);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const tokens = await generateTokens(user);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user, tokens }
    });
  } catch (err) {
    next(err);
  }
}

async function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token is required' });
    }
    const refreshData = await validateRefreshToken(refreshToken);
    if (!refreshData) {
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }
    const user = await User.findById(refreshData.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    await revokeRefreshToken(refreshData.tokenId);
    const tokens = await generateTokens(user);
    res.status(200).json({ success: true, data: { tokens } });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refreshToken };
