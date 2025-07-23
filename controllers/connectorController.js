// controllers/connectorController.js
const createResourceService = require('../utils/createResourceService');
const Connector = require('../models/connectorModel');
const path = require('path');

const dataPath = path.join(__dirname, '../data/connectors.json');
const connectorService = createResourceService(Connector, dataPath);

module.exports = connectorService;
