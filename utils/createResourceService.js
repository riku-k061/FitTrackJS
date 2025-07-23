const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

function createResourceService(resourceName) {
  const file = path.join(config.dataPath || 'data', `${resourceName}.json`);
  return {
    async getAll() {
      const txt = await fs.readFile(file, 'utf8');
      return JSON.parse(txt);
    },
    async getById(id) {
      return (await this.getAll()).find(r => r.id === id);
    },
    async getByFilter(fn) {
      return (await this.getAll()).filter(fn);
    },
    async create(obj) {
      const arr = await this.getAll();
      arr.push(obj);
      await fs.writeFile(file, JSON.stringify(arr, null, 2));
      return obj;
    },
    async update(id, upd) {
      const arr = await this.getAll();
      const i = arr.findIndex(r => r.id === id);
      if (i < 0) throw new Error(`${resourceName} ${id} not found`);
      arr[i] = { ...arr[i], ...upd };
      await fs.writeFile(file, JSON.stringify(arr, null, 2));
      return arr[i];
    },
    async delete(id) {
      const arr = await this.getAll();
      const out = arr.filter(r => r.id !== id);
      if (out.length === arr.length) throw new Error(`${resourceName} ${id} not found`);
      await fs.writeFile(file, JSON.stringify(out, null, 2));
      return { success: true };
    }
  };
}

module.exports = createResourceService;
