const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');
const { readJSONFile, writeJSONFile } = require('./fileUtils');
const { backupFile, restoreFromBackup } = require('./transactionUtils');

const REFRESH_TOKENS_FILE = 'refresh_tokens.json';

async function generateTokens(user) {
  const accessPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  }
  const refreshTokenId = uuidv4();
  const refreshPayload = { sub: user.id, jti: refreshTokenId };

  const accessToken = jwt.sign(accessPayload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn
  });
  const refreshToken = jwt.sign(refreshPayload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn
  });

  await storeRefreshToken(refreshTokenId, user.id);

  return { accessToken, refreshToken };
}

async function storeRefreshToken(tokenId, userId) {
  const tokens = await readJSONFile(REFRESH_TOKENS_FILE);
  tokens.push({
    id: tokenId,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7*24*60*60*1000).toISOString()
  });
  await writeJSONFile(REFRESH_TOKENS_FILE, tokens);
}

async function validateRefreshToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    const tokens = await readJSONFile(REFRESH_TOKENS_FILE);
    const exists = tokens.some(t => t.id === decoded.jti && t.userId === decoded.sub);
    return exists ? { userId: decoded.sub, tokenId: decoded.jti } : null;
  } catch {
    return null;
  }
}

async function revokeRefreshToken(tokenId) {
  const tokens = await readJSONFile(REFRESH_TOKENS_FILE);
  const updated = tokens.filter(t => t.id !== tokenId);
  await writeJSONFile(REFRESH_TOKENS_FILE, updated);
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch {
    return null;
  }
}


async function prepareDeleteUserTokens(userId) {
  await backupFile(REFRESH_TOKENS_FILE);
  const tokens = await readJSONFile(REFRESH_TOKENS_FILE);
  const userTokens = tokens.filter(t => t.userId === userId);
  const updated = tokens.filter(t => t.userId !== userId);
  return {
    execute: async () => {
      await writeJSONFile(REFRESH_TOKENS_FILE, updated);
      return { tokensRemoved: userTokens.length };
    },
    rollback: async () => restoreFromBackup(REFRESH_TOKENS_FILE)
  };
}

module.exports = {
  generateTokens,
  validateRefreshToken,
  revokeRefreshToken,
  verifyAccessToken,
  prepareDeleteUserTokens
};
