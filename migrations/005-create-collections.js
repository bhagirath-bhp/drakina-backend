'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('collections', {
      collectionId:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      hasSpells:{
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }
    })
  },

  async down (queryInterface, Sequelize) {
    return queryInterface.dropTable('collections')
  },
  order:6,
};
