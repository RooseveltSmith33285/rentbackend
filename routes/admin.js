const router=require('express').Router();
const {getUsers,updateUser,loginAdmin,updateVendor,deleteVendor,getVendors,resetAdmin,createAdmin,deleteUser,getDashboardData,pauseSubscription,getProducts,unPauseSubscription, updateProduct, getOrders}=require('../controller/admin')
let upload=require('../middleware/upload')

router.get('/getDashboardData',getDashboardData)
router.put('/admin/updateProduct/:id', upload.single('images'), updateProduct)
router.get('/getUsers',getUsers)
router.get('/getVendors',getVendors)
router.put('/update-user/:id',updateUser)
router.put('/update-vendor/:id',updateVendor)
router.delete('/delete-user/:id',deleteUser)

router.delete('/deleteVendor/:id',deleteVendor)
router.get('/admin/getProducts',getProducts)
router.get('/get-orders',getOrders)
router.patch('/pauseSubscription/:subscriptionId',pauseSubscription)
router.patch('/unpauseSubscription/:subscriptionId',unPauseSubscription)
router.post('/loginAdmin',loginAdmin)
router.post('/createAdmin',createAdmin)
router.patch('/resetAdmin',resetAdmin)

module.exports=router;