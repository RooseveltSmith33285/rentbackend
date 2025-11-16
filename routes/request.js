const {sendRequestUser,getRequestsUser,releasePaymentToVendor,approveOfferByUser,getRequestById,rejectRequestOffer,rejectOffer}=require('../controller/request');
const { Auth } = require('../middleware/auth');
const router=require('express').Router();

router.post('/sendRequestUser',Auth,sendRequestUser)
router.get('/getRequestsUser',Auth,getRequestsUser)
router.patch('/rejectOffer/:id',rejectOffer)
router.patch('/rejectRequestOffer/:id',rejectRequestOffer)
router.get('/getRequestById/:id',getRequestById)
router.post('/approveOfferByUser',Auth,approveOfferByUser)
router.post('/releasePaymentToVendor',releasePaymentToVendor)
module.exports=router;  