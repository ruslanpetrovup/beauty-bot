const { DataTypes } = require('sequelize');
const sequelize = require('../index');
const Master = require('./master');

const Schedule = sequelize.define('Schedule', {
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
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  timeStart: {
    type: DataTypes.TIME,
    allowNull: false
  },
  timeEnd: {
    type: DataTypes.TIME,
    allowNull: false
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

Master.hasMany(Schedule);
Schedule.belongsTo(Master);

module.exports = Schedule; 