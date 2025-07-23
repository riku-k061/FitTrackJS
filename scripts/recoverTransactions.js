const fs     = require('fs').promises;
const path   = require('path');
const { getDataFilePath } = require('../utils/fileUtils');
const logger = require('../utils/loggerUtils');

async function recoverTransactions() {
  const d = path.dirname(getDataFilePath('dummy.json'));
  const files = await fs.readdir(d);
  const temps = files.filter(f=>f.endsWith('.tmp'));
  for(const tmp of temps) {
    const [base] = tmp.split(/\.[0-9a-f-]+\.tmp$/);
    const tmpPath  = path.join(d,tmp);
    const basePath = path.join(d,base);
    try {
      const txt = await fs.readFile(tmpPath,'utf8');
      JSON.parse(txt);
      await fs.rename(tmpPath, basePath);
      logger.warn(`Recovered ${base}`);
    } catch {
      await fs.unlink(tmpPath).catch(()=>{});
      logger.error(`Dropping invalid temp ${tmp}`);
    }
  }
}

if(require.main===module){
  recoverTransactions()
    .then(()=>process.exit(0))
    .catch(()=>process.exit(1));
}

module.exports = { recoverTransactions };
