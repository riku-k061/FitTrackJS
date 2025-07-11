const express = require('express');
const {
  create,
  getUsers,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/userController');
const jwtMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware, ownershipMiddleware, ROLES } = require('../middleware/roleMiddleware');

const router = express.Router();

router.post('/', create);
router.use(jwtMiddleware);

router.get('/', roleMiddleware([ROLES.ADMIN, ROLES.COACH]), getUsers);
router.get('/:id', ownershipMiddleware, getUserById);
router.put('/:id', ownershipMiddleware, updateUser);
router.delete('/:id', roleMiddleware([ROLES.ADMIN]), deleteUser);

module.exports = router;
