const { readDataFile } = require('./fileUtils');

const indexes = new Map();

async function buildIndexes(filePath, fields=[]) {
  if (!indexes.has(filePath)) indexes.set(filePath, new Map());
  const fileIdx = indexes.get(filePath);
  const data = await readDataFile(filePath);

  // init maps
  fields.forEach(f => fileIdx.set(f, new Map()));
  fileIdx.set('timestamp', new Map());

  data.forEach((item, i) => {
    fields.forEach(field => {
      const idx = fileIdx.get(field);
      const value = item[field];
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => {
            idx.has(v) ? idx.get(v).push(i) : idx.set(v,[i]);
          });
        } else {
          idx.has(value) ? idx.get(value).push(i) : idx.set(value,[i]);
        }
      }
    });
    // date → timestamp index
    if (item.date) {
      const t = new Date(item.date).getTime();
      fileIdx.get('timestamp').set(i,t);
    }
  });
  return fileIdx;
}

async function findByIndex(filePath, field, val) {
  if (!indexes.has(filePath) || !indexes.get(filePath).has(field)) {
    await buildIndexes(filePath, [field]);
  }
  const idx = indexes.get(filePath).get(field);
  return idx.has(val) ? [...idx.get(val)] : [];
}

async function findByDateRange(filePath, start, end) {
  if (!indexes.has(filePath)) await buildIndexes(filePath,['date']);
  const idx = indexes.get(filePath).get('timestamp');
  const from = start ? new Date(start).getTime() : -Infinity;
  const to   = end   ? new Date(end).getTime()   : Infinity;
  return [...idx.entries()]
           .filter(([_,t])=>t>=from && t<=to)
           .map(([pos])=>pos);
}

async function findByMultipleFilters(filePath, filters={}) {
  const flds = Object.keys(filters).filter(k=>k!=='startDate'&&k!=='endDate');
  if (filters.startDate||filters.endDate) flds.push('date');
  if (flds.length) await buildIndexes(filePath,flds);

  const sets = [];
  for (const [k,v] of Object.entries(filters)) {
    if (k==='startDate'||k==='endDate') continue;
    if (v!==undefined) {
      const pos = await findByIndex(filePath,k,v);
      if (!pos.length) return [];
      sets.push(new Set(pos));
    }
  }
  if (filters.startDate||filters.endDate) {
    const pos = await findByDateRange(filePath,filters.startDate,filters.endDate);
    if (!pos.length) return [];
    sets.push(new Set(pos));
  }
  if (!sets.length) return [...Array((await readDataFile(filePath)).length).keys()];

  // intersect
  return [...sets.reduce((a,b)=>
    new Set([...a].filter(x=>b.has(x)))
  )];
}

async function getFilteredData(filePath, opts={}) {
  const {
    userId, exerciseType, startDate, endDate,
    limit=10, offset=0, sort='date', order='desc'
  } = opts;

  const filters = {};
  if (userId) filters.userId = userId;
  if (exerciseType) filters.exerciseType = exerciseType;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  const data = await readDataFile(filePath);
  const positions = await findByMultipleFilters(filePath,filters);

  let items = positions.map(i=>data[i]);
  // sort
  items.sort((a,b)=>{
    let av=a[sort], bv=b[sort];
    if (sort==='date') { av=new Date(av); bv=new Date(bv); }
    if (typeof av==='number'&&typeof bv==='number') return order==='desc'?bv-av:av-bv;
    return order==='desc'? String(bv).localeCompare(av):String(av).localeCompare(bv);
  });

  const page = items.slice(offset, offset+limit);
  return {
    data: page,
    pagination: {
      total: items.length,
      limit, offset,
      hasMore: offset+limit < items.length
    }
  };
}

function invalidateIndex(filePath) {
  indexes.delete(filePath);
}

const indexCache = {
  nutritionLogs: null,
  timestamps: { nutritionLogs: null }
};

async function createIndexes(collection) {
  const filePath = path.join(__dirname, `../data/${collection}.json`);
  const stats = await fs.stat(filePath);
  const mtime = stats.mtime.getTime();

  if (indexCache[collection] && indexCache.timestamps[collection] === mtime) {
    return indexCache[collection];
  }

  const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
  if (collection === 'nutritionLogs') {
    const byUserId = {}, byDate = {}, byMealType = {};
    data.forEach(log => {
      (byUserId[log.userId] ||= []).push(log);
      (byDate[log.date] ||= []).push(log);
      (byMealType[log.mealType] ||= []).push(log);
    });
    indexCache[collection] = { all: data, byUserId, byDate, byMealType };
  } else {
    // generic id index
    const byId = {};
    data.forEach(item => byId[item.id] = item);
    indexCache[collection] = { all: data, byId };
  }
  indexCache.timestamps[collection] = mtime;
  return indexCache[collection];
}

async function getById(collection, id) {
  const idx = await createIndexes(collection);
  return idx.byId ? idx.byId[id] : undefined;
}

async function getNutritionLogs(filters = {}, limit = 10, offset = 0) {
  const idx = await createIndexes('nutritionLogs');
  let list = [...idx.all];

  if (filters.userId)    list = idx.byUserId[filters.userId] || [];
  if (filters.dateFrom || filters.dateTo) {
    list = list.filter(log => {
      const d = new Date(log.date);
      if (filters.dateFrom && new Date(filters.dateFrom) > d) return false;
      if (filters.dateTo   && new Date(filters.dateTo)   < d) return false;
      return true;
    });
  }
  if (filters.mealType)  list = list.filter(l => l.mealType === filters.mealType);

  list.sort((a,b) => new Date(b.date) - new Date(a.date));
  const page = list.slice(offset, offset + limit);

  return {
    logs: page,
    total: list.length,
    limit, offset,
    hasMore: offset + page.length < list.length
  };
}

module.exports = { buildIndexes, getFilteredData, invalidateIndex, createIndexes, getById, getNutritionLogs };
