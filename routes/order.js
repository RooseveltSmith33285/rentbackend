const router=require('express').Router();
const {createOrder,verifyCalandar}=require('../controller/order')
const {Auth}=require('../middleware/auth')
router.post('/createOrder',Auth,createOrder)
router.get('/verifyCalandar',Auth,verifyCalandar)
module.exports=router;