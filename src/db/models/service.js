const { DataTypes } = require('sequelize');
const sequelize = require('../index');
const Master = require('./master');

const Service = sequelize.define('Service', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  masterId: {
    type: DataTypes.INTEGER,
    references: {
      model: Master,
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER, // длительность в минутах
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

Master.hasMany(Service);
Service.belongsTo(Master);

module.exports = Service; 