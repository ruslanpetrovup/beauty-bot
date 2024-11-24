const serviceManagement = require('./services');
const scheduleManagement = require('./schedule');
const broadcast = require('./broadcast');
const appointmentManagement = require('../client/appointments');
const profileSettings = require('./profileSettings');
const masterRegistration = require('./registration');

module.exports = {
  masterRegistration,
  serviceManagement,
  scheduleManagement,
  broadcast,
  appointmentManagement,
  profileSettings
};