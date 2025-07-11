const { User, ROLES } = require('../models/userModel');
const { validateUser } = require('../utils/validation');
const { readJSONFile } = require('../utils/fileUtils');
const { computeDiff, createAuditLog } = require('../utils/auditLogUtils');
const { executeTransaction } = require('../utils/transactionUtils');
const { prepareDeleteUserTokens } = require('../utils/tokenUtils');
const { prepareDeleteAuditLog } = require('../utils/auditLogUtils');
const { prepareDeleteUserWorkouts } = require('../utils/workoutUtils');
const { prepareDeleteUserNutritionLogs } = require('../utils/nutritionUtils');

const USERS_FILE = 'users.json';

async function create(req, res, next) {
  try {
    const existing = await readJSONFile(USERS_FILE);
    const { isValid, errors } = validateUser(req.body, existing);
    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          details: errors.map(error => ({ 
            field: error.includes('Email') ? 'email' : 
                   error.includes('Password') ? 'password' :
                   error.includes('Name') ? 'name' :
                   error.includes('Height') ? 'height' :
                   error.includes('Weight') ? 'weight' :
                   error.includes('goals') ? 'fitnessGoals' : 'general',
            message: error 
          })) 
        } 
      });
    }
    const user = await User.create(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    if (err.message === 'Email already in use' && err.statusCode === 400) {
      return res.status(400).json({
        success: false,
        error: {
          details: [{
            field: 'email',
            message: 'Email is already in use'
          }]
        }
      });
    }
    next(err);
  }
}

async function getUsers(req, res, next) {
  try {
    const users = await User.findAll();
    if (req.user.role === ROLES.COACH) {
      const filtered = users.filter(u => u.role === ROLES.USER);
      return res.status(200).json({ success: true, count: filtered.length, data: filtered });
    }
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const userId = req.params.id;
    const updateOp = await User.prepareUpdate(userId, req.body);
    if (!updateOp) return res.status(404).json({ success: false, error: 'User not found' });

    const changes = computeDiff(updateOp.oldUser, updateOp.updatedUser);
    let auditOp = { execute: async () => null, rollback: async () => {} };
    if (Object.keys(changes).length) {
      auditOp = {
        execute: async () => createAuditLog('user', userId, 'update', changes, req.user),
        rollback: async () => { console.log('Audit rollback'); }
      };
    }

    const [updatedUser] = await executeTransaction([updateOp, auditOp]);
    res.status(200).json({ success: true, data: updatedUser, auditLog: !!changes.length });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const userId = req.params.id;
    const actor = req.user;

    const deleteUserOp = await User.prepareDelete(userId);
    if (!deleteUserOp) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const userToDelete = deleteUserOp.user;

    const deleteTokensOp = await prepareDeleteUserTokens(userId);
    const deleteWorkoutsOp = await prepareDeleteUserWorkouts(userId);
    const deleteNutritionOp = await prepareDeleteUserNutritionLogs(userId);
    const auditOp = await prepareDeleteAuditLog('user', userId, userToDelete, actor);

    const [
      userRes,
      tokensRes,
      workoutsRes,
      nutritionRes,
      auditRes
    ] = await executeTransaction([
      deleteUserOp,
      deleteTokensOp,
      deleteWorkoutsOp,
      deleteNutritionOp,
      auditOp
    ]);

    res.status(200).json({
      success: true,
      message: 'User and all related data successfully deleted',
      details: {
        userId,
        tokensRemoved: tokensRes.tokensRemoved,
        workoutsRemoved: workoutsRes.workoutsRemoved,
        nutritionLogsRemoved: nutritionRes.logsRemoved,
        auditLogCreated: !!auditRes
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  getUsers,
  getUserById,
  updateUser,
  deleteUser
};
