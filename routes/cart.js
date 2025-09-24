const router=require('express').Router();
const {addItemsToCart,getCartItems,removeFromCart}=require('../controller/cart')
const {Auth}=require('../middleware/auth')
router.post('/addItemsToCart',Auth,addItemsToCart)
router.get('/getCartItems',Auth,getCartItems)
router.delete('/removeFromCart',Auth,removeFromCart)
module.exports=router;