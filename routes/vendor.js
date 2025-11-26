const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {cloudinaryUploadImage}=require('../middleware/cloudinary')
const {approveRequest,rejectRequest,changeVendorPassword,checkStripeAccountStatus}=require('../controller/vendor')
const {sendMessage,getConversation,renewListing, generateStripeOnboardingLink ,getVendorRequests,getUser,seenMessages,getConversations,getMessages}=require('../controller/vendor')
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

const {getVendorInfo,getVendorProfile,updateVendorProfile}=require('../controller/vendor')

let upload=require('../middleware/upload')
const {Auth}=require('../middleware/auth')



router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    console.log('=== Upload Request Started ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('File:', req.file);
    
    if (!req.file) {
      console.error('No file received in request');
      return res.status(400).json({ 
        error: 'No image file provided',
        received: {
          body: req.body,
          headers: req.headers['content-type']
        }
      });
    }

    console.log('File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      filename: req.file.filename
    });

    // Verify file exists and is readable
    if (!fs.existsSync(req.file.path)) {
      throw new Error(`File was not saved to disk: ${req.file.path}`);
    }

    const fileStats = fs.statSync(req.file.path);
    console.log('File on disk:', {
      size: fileStats.size,
      isFile: fileStats.isFile(),
      readable: fs.constants.R_OK
    });

    // Check file permissions
    try {
      fs.accessSync(req.file.path, fs.constants.R_OK);
      console.log('File is readable');
    } catch (err) {
      throw new Error(`File is not readable: ${err.message}`);
    }

    console.log('Starting Cloudinary upload...');
    const result = await cloudinaryUploadImage(req.file.path);
    console.log('Cloudinary upload completed successfully');

    // Cleanup
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log('Temporary file deleted');
    }

    res.status(200).json({
      success: true,
      url: result.url,
      public_id: result.public_id
    });

  } catch (error) {
    console.error('=== Upload Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('File info:', {
      path: req.file?.path,
      exists: req.file ? fs.existsSync(req.file.path) : false,
      size: req.file?.size
    });
    
    // Cleanup on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('Cleaned up temporary file after error');
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError.message);
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to upload image',
      details: error.message,
      file: req.file ? {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      } : null
    });
  }
});



router.post('/listings' , Auth,createListing);
router.get('/listings', Auth, getVendorListings);
router.put('/listings/:id', Auth,upload.array('images'),updateListing);
router.delete('/listings/:id', Auth,deleteListing);
router.get('/getVendorInfo/:id',getVendorInfo)

router.post('/boost',  Auth,createBoost);
router.post('/updateStatus',Auth,updateStatus)
router.get('/boosts',  getActiveBoosts);


router.post('/community/posts',Auth,upload.array('images'),createPost);
router.get('/getVendorDashboardData',Auth,getDashboardData)
router.get('/getVendorListingsFeed',Auth,getVendorListingsFeed)
router.get('/getListingById/:id',Auth,getListingById)
router.get('/posts',getFeed)
router.get('/vendor/profile',Auth,getVendorProfile)





router.post('/vendor/sendMessage',Auth,sendMessage)
router.get('/vendor/getMessages/:user',Auth,getMessages)
router.get('/vendor/getConversations',Auth,getConversations)
router.get('/vendor/getConversation/:vendor',Auth,getConversation)
router.get('/vendor/seenMessages/:user',Auth,seenMessages)
router.get('/vendor/getUserInfo/:user',getUser)
router.get('/getVendorRequests',Auth,getVendorRequests)


router.post('/approveRequest', upload.fields([
  { name: 'front', maxCount: 1 },
  { name: 'side', maxCount: 1 },
  { name: 'serialTag', maxCount: 1 },
  { name: 'condition', maxCount: 1 }
]), approveRequest)


router.patch('/rejectRequest',rejectRequest)
router.post('/renewListing',renewListing)
router.post('/checkStripeAccountStatus',checkStripeAccountStatus)
router.get('/generateStripeOnboardingLink',Auth,generateStripeOnboardingLink)
router.put('/updateVendorProfile',Auth,updateVendorProfile)
router.put('/changeVendorPassword',Auth,changeVendorPassword)


module.exports = router;