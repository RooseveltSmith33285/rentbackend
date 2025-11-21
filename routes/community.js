const express = require('express');
const router = express.Router();
const {Auth} = require('../middleware/auth'); 
const upload = require('../middleware/upload'); 

const {
  likePost,
  unlikePost,
  createComment,
  getComments,
  getPost,
  deleteComment
} = require('../controller/community');



router.post('/community/posts/:postId/like', Auth, likePost);
router.delete('/community/posts/:postId/like', Auth, unlikePost);


router.post('/community/posts/:postId/comments', Auth, createComment);
router.get('/community/posts/:postId/comments', getComments);
router.delete('/community/posts/:postId/comments/:commentId', Auth, deleteComment);
router.get('/community/posts/:postId', getPost);
module.exports = router;