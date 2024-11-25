const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  telegramId: {
    type: DataTypes.STRING,
    unique: true
  },
});

module.exports = Admin; 