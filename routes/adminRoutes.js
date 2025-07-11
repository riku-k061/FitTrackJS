const express = require('express');
const { User, ROLES } = require('../models/userModel');
const jwtMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = express.Router();
router.use(jwtMiddleware, roleMiddleware([ROLES.ADMIN]));

router.post('/users', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role || role === ROLES.USER) {
      return res.status(400).json({ success: false, error: 'Must specify a role of coach or admin' });
    }
    if (![ROLES.COACH, ROLES.ADMIN].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role specified' });
    }
    const newUser = await User.create(req.body);
    res.status(201).json({ success: true, data: newUser });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
