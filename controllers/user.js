const sequelize = require('../db/db')
const User = require('../models/user')
const cookieToken = require('../utils/cookieToken')
const bcrypt = require('bcryptjs')

exports.signup = async(req,res) => {
    try {
        const {first_name,last_name,email,password, phone_number} = req.body

        const existingUser = await User.findOne({where: {email: email}})
        if(existingUser){
            return res.status(400).json("user already exists")
        }

        const user = await User.create({
            first_name,
            last_name,
            email,
            phone_number,
            password
        })

        cookieToken(user,res)
    } catch (error) {
        console.error(error);
        return res.status(500).json("Internal Server Error")
    }
}

exports.login = async(req,res) => {
    try {
        const {email,password,phone_number} = req.body 
        const user = await User.findOne({
            where: {
                [email ? "email" : "phone_number"]:email||phone_number
            }
        })

        if(!user){
            return res.status(400).json("no user found")
        }

        const isValidated = await bcrypt.compare(password,user.password)

        if(!isValidated){
            return res.status(400).json("wrong credentials")
        }

        cookieToken(user,res)
    } catch (error) {
        console.error(error);
        return res.status(500).json("Internal Server Error")
    }
}

exports.me = async(req,res) => {
    try {
        const {id} = req.body
        let userId = Number(id)
        const user = await User.findByPk(userId,{
            attributes: ['first_name', 'last_name', 'email']
        })
        if(user){
            return res.status(200).json(user)
        }else{
            return res.status(400).json({"message": "User not found"})
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json("Internal Server Error")
    }
}