const { DataTypes } = require('sequelize');
const sequelize = require('../index');
const Master = require('./master');
const Client = require('./client');
const Service = require('./service');

const Appointment = sequelize.define('Appointment', {
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
  clientId: {
    type: DataTypes.INTEGER,
    references: {
      model: Client,
      key: 'id'
    }
  },
  serviceId: {
    type: DataTypes.INTEGER,
    references: {
      model: Service,
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
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
    defaultValue: 'pending'
  },
  comment: {
    type: DataTypes.TEXT
  },
  rating: {
    type: DataTypes.INTEGER,
    validate: {
      min: 1,
      max: 5
    }
  },
  review: {
    type: DataTypes.TEXT
  }
});

Master.hasMany(Appointment);
Client.hasMany(Appointment);
Service.hasMany(Appointment);
Appointment.belongsTo(Master);
Appointment.belongsTo(Client);
Appointment.belongsTo(Service);

module.exports = Appointment; 