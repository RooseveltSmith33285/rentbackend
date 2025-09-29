const router=require('express').Router();
const {addItemsToCart,updateTvscreen,getCartItems,removeFromCart}=require('../controller/cart')
const {Auth}=require('../middleware/auth')
router.post('/addItemsToCart',Auth,addItemsToCart)
router.get('/getCartItems',Auth,getCartItems)
router.delete('/removeFromCart',Auth,removeFromCart)
router.patch('/updateTvscreen',Auth,updateTvscreen)
module.exports=router;