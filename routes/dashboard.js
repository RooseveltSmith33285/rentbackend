const {getDashboardData}=require('../controller/dashboard')
const {Auth}=require('../middleware/auth')

const router=require('express').Router();

router.get('/getDashboardData',Auth,getDashboardData)
module.exports=router;