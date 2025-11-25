
const {register,login,getUser,updateUser,changeUserPassword,resetPassword}=require('../controller/auth')
const router=require('express').Router()
const {Auth}=require('../middleware/auth')

router.post('/register',register)
router.post('/login',login)
router.get('/getUser',Auth,getUser)
router.patch('/resetPassword',resetPassword)
router.patch('/updateUser',Auth,updateUser)
router.patch('/user/changeUserPassword',Auth,changeUserPassword)
module.exports=router;