const router=require('express').Router();
const {createOrder,getRecentOrder,verifyCalandar}=require('../controller/order')
const {Auth}=require('../middleware/auth')
router.post('/createOrder',Auth,createOrder)
router.get('/verifyCalandar',Auth,verifyCalandar)
router.get('/getRecentOrder',Auth,getRecentOrder)
module.exports=router;