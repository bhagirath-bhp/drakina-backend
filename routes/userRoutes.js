const express = require('express')
const {signup,login, me} = require('../controllers/user')
const {isLoggedIn} = require('../middleware/auth')

const router = express.Router()

router.post("/signup",signup)
router.post("/login",login)
router.post("/me", isLoggedIn, me)

module.exports = router