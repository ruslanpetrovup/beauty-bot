const { DataTypes } = require('sequelize');
const sequelize = require('../index');

const Master = sequelize.define('Master', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  telegramId: {
    type: DataTypes.STRING,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING
  },
  paymentDetails: {
    type: DataTypes.JSONB
  },
  salonName: {
    type: DataTypes.STRING
  },
  address: {
    type: DataTypes.STRING
  },
  description: {
    type: DataTypes.STRING
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

module.exports = Master; 