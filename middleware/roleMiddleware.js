const { User, ROLES } = require('../models/userModel');

function roleMiddleware(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}

async function ownershipMiddleware(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
  const { id: requestedId } = req.params;
  const { sub: currentId, role } = req.user;

  if (role === ROLES.ADMIN) return next();
  if (role === ROLES.USER && requestedId !== currentId) {
    // Check if the requested user exists first
    const user = await User.findById(requestedId);
    if (!user) {
      // Let the controller handle the 404 response
      return next();
    }
    return res.status(403).json({ success: false, error: 'Access denied: You can only access your own profile' });
  }
  if (role === ROLES.COACH && requestedId !== currentId) {
    const user = await User.findById(requestedId);
    if (!user) {
      // Let the controller handle the 404 response  
      return next();
    }
    if (user.role !== ROLES.USER) {
      return res.status(403).json({ success: false, error: 'Access denied: This user is not your client' });
    }
  }
  next();
}

module.exports = { roleMiddleware, ownershipMiddleware, ROLES };
