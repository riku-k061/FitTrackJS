const { getDataFilePath } = require('./utils/fileUtils');
console.log('getDataFilePath imported successfully:', typeof getDataFilePath);
console.log('Test path:', getDataFilePath('test.json')); 