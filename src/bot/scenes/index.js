const { Scenes } = require('telegraf');
const clientRegistrationScene = require('./clientScenes');
const masterRegistrationScene = require('./masterScenes');
const editProfileScene = require('./clientScenes/editProfileScene');
const appointmentScenes = require('./clientScenes/appointmentScenes');
const switchRoleScene = require('./switchRoleScene');
const { addServiceScene, deleteServiceScene,editServicesScene } = require('./masterScenes/serviceManagementScenes');
const { viewAppointmentsScene } = require('./masterScenes/clientManagementScenes');

const stage = new Scenes.Stage([
    clientRegistrationScene,
    masterRegistrationScene,
    editProfileScene,
    appointmentScenes.selectServiceScene,
    appointmentScenes.selectDateTimeScene,
    switchRoleScene,
    addServiceScene,
    viewAppointmentsScene,
    deleteServiceScene,
    editServicesScene,
]);

module.exports = stage; 