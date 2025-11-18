
const router=require('express').Router();
const {getUserListenings}=require('../controller/userlistening');
const { Auth } = require('../middleware/auth');
router.get('/getUserListenings',Auth,getUserListenings)

module.exports=router;