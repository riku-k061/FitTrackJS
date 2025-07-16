const { verifyAccessToken } = require('../utils/tokenUtils');

function jwtMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, error: { message: 'Invalid or expired token' } });
  }
  req.user = decoded;
  next();
}

module.exports = jwtMiddleware;
