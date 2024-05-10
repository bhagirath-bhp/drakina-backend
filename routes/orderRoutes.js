const express = require('express')
const {isLoggedIn, checkRole} = require('../middleware/auth')
const {addOrder,getAllOrdersForAUser,success,getOrderDetails,getAllOrdersForAdmin, test} = require('../controllers/order')

const router = express.Router()

router.post("/orders/add",isLoggedIn,addOrder)
router.get("/orders/:userId",isLoggedIn,getAllOrdersForAUser)
router.get("/admin/orders",isLoggedIn,checkRole('admin'),getAllOrdersForAdmin)
router.get("/orders",isLoggedIn,success)
router.get("/order/:id",isLoggedIn,getOrderDetails)
router.post("/test", isLoggedIn, test)


module.exports = router