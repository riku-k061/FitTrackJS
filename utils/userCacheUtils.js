const { readDataFile } = require('./fileUtils');
const USER_FILE = 'data/users.json';

let cache = null, mapById = null, last = 0;
const TTL = 60_000;

async function loadUsers(force=false) {
  const now = Date.now();
  if (!force && cache && now - last < TTL) {
    return { cache, mapById };
  }
  const users = await readDataFile(USER_FILE);
  const m = new Map();
  users.forEach(u=> m.set(u.id, { id:u.id, name:u.name, email:u.email }));
  cache = users; mapById = m; last = now;
  return { cache, mapById };
}

async function userExists(id) {
  const { mapById } = await loadUsers();
  return mapById.has(id);
}

async function enrichWorkoutsWithUserInfo(workouts, fields=['name','email']) {
  if (!workouts.length) return workouts;
  const { mapById } = await loadUsers();
  return workouts.map(wk=>{
    const e = { ...wk };
    const u = mapById.get(wk.userId);
    if (u) {
      e.user = {};
      fields.forEach(f=> { if (u[f]!==undefined) e.user[f]=u[f]; });
    }
    return e;
  });
}

module.exports = { userExists, enrichWorkoutsWithUserInfo };
