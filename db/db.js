const {Sequelize} = require('sequelize')
require('dotenv').config()

const sequelize = process.env.NODE_ENV === "test" || process.env.NODE_ENV === "production" ? new Sequelize(process.env.PROD_DB_NAME, process.env.PROD_DB_USER,  process.env.PROD_DB_PASSWORD, {
    dialect: 'postgres',
    host: process.env.PROD_DB_HOST,
    dialectOptions:{
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
}) : new Sequelize(process.env.DB_NAME, process.env.DB_USER,  process.env.DB_PASSWORD, {
    dialect: 'postgres',
    host: process.env.DB_HOST
})

module.exports = sequelize
