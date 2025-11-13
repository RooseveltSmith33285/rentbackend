const router=require('express').Router();
const {sendMessage,getMessages,getConversation,seenMessages,getConversations}=require('../controller/chat')
const {Auth}=require('../middleware/auth')
router.post('/sendMessage',Auth,sendMessage)
router.get('/getMessages',Auth,getMessages)
router.get('/getConversations',Auth,getConversations)
router.get('/getConversation/:vendor',Auth,getConversation)
router.get('/seenMessages/:vendor',Auth,seenMessages)
module.exports=router;