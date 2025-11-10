const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {cloudinaryUploadImage}=require('../middleware/cloudinary')
const fs = require('fs');
const {
  createListing,
  getVendorListings,
  updateListing,
  deleteListing,
  getVendorListingsFeed,
  updateStatus,
  getDashboardData,
  getListingById    
} = require('../controller/listening');
const {
  createBoost,
  getActiveBoosts
} = require('../controller/boost');
const {
  createPost,
  getFeed
} = require('../controller/community');

const { getVendorProfile}=require('../controller/vendor')
let upload=require('../middleware/upload')
const {Auth}=require('../middleware/auth')



router.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }
  
     
      const result = await cloudinaryUploadImage(req.file.path);
  
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
  
      res.status(200).json({
        success: true,
        url: result.url,
        public_id: result.public_id
      });
  
    } catch (error) {
      console.error('Image upload error:', error);
      
    
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ 
        error: 'Failed to upload image',
        details: error.message 
      });
    }
  });



router.post('/listings' , Auth,createListing);
router.get('/listings', Auth, getVendorListings);
router.put('/listings/:id', Auth,upload.array('images'),updateListing);
router.delete('/listings/:id', Auth,deleteListing);


router.post('/boost',  Auth,createBoost);
router.post('/updateStatus',Auth,updateStatus)
router.get('/boosts',  getActiveBoosts);


router.post('/community/posts',Auth,upload.array('images'),createPost);
router.get('/getVendorDashboardData',Auth,getDashboardData)
router.get('/getVendorListingsFeed',Auth,getVendorListingsFeed)
router.get('/getListingById/:id',Auth,getListingById)
router.get('/posts',getFeed)
router.get('/vendor/profile',Auth,getVendorProfile)


module.exports = router;