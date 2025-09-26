const router=require('express').Router();
const {getUsers,updateUser,deleteUser,getDashboardData,pauseSubscription,getProducts,unPauseSubscription, updateProduct, getOrders}=require('../controller/admin')
let upload=require('../middleware/upload')

router.get('/getDashboardData',getDashboardData)
router.put('/updateProduct/:id',upload.single('photo'),updateProduct)
router.get('/getUsers',getUsers)
router.put('/update-user/:id',updateUser)
router.delete('/delete-user/:id',deleteUser)
router.get('/getProducts',getProducts)
router.get('/get-orders',getOrders)
router.patch('/pauseSubscription/:subscriptionId',pauseSubscription)
router.patch('/unpauseSubscription/:subscriptionId',unPauseSubscription)

module.exports=router;