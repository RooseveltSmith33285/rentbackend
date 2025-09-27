
const {register,login,getUser,resetPassword}=require('../controller/auth')
const router=require('express').Router()
const {Auth}=require('../middleware/auth')

router.post('/register',register)
router.post('/login',login)
router.get('/getUser',Auth,getUser)
router.patch('/resetPassword',resetPassword)
module.exports=router;