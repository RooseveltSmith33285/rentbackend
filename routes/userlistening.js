
const router=require('express').Router();
const {getUserListenings}=require('../controller/userlistening')
router.get('/getUserListenings',getUserListenings)

module.exports=router;