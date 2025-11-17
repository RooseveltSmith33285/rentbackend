const Listing = require('../models/listing');
const Vendor = require('../models/vendor');
const fs=require('fs')
const CommunityPost = require('../models/communitypost');
const {cloudinaryUploadImage}=require('../middleware/cloudinary');
const requestModel = require('../models/request');
const messageModel = require('../models/messages');



exports.createListing = async (req, res) => {
    try {
      const {
        title,
        category,
        brand,
        condition,
        rentPrice,
        buyPrice,
        description,
        images, // This will now contain Cloudinary URLs
        publishToFeed,
        listAsActive,
        specifications,
        location
      } = req.body;
  
      if (!title || !category || !brand || !condition || !rentPrice || !buyPrice || !description) {
        return res.status(400).json({
          error: 'Please provide all required fields'
        });
      }
  
      if (!images || images.length === 0) {
        return res.status(400).json({
          error: 'Please upload at least one image'
        });
      }
  let id=req?.user?._id?req.user._id:req.user.id

      const vendor = await Vendor.findById(id);
      
      if (vendor.subscription.plan === 'basic' && vendor.stats.activeListings >= 10) {
        return res.status(403).json({
          error: 'You have reached your listing limit. Please upgrade your plan.'
        });
      }
  
      console.log("HERE")
      const listing = await Listing.create({
        vendor: id,
        title,
        category,
        brand,
        condition,
        pricing: {
          rentPrice,
          buyPrice
        },
        description,
        images: images, // Already contains Cloudinary URLs
        specifications,
        status: listAsActive ? 'active' : 'draft',
        availability: {
          isAvailable: true,
          location
        },
        publishToFeed
      });
  
      console.log("THERE")
      vendor.stats.totalListings += 1;
      if (listAsActive) {
        vendor.stats.activeListings += 1;
      }
      await vendor.save();
  
      if (publishToFeed && listAsActive) {
        await CommunityPost.create({
          vendor: id,
          type: 'announcement',
          content: `New listing available: ${title}! Check it out for rent at $${rentPrice}/month or buy for $${buyPrice}.`,
          linkedListing: listing._id
        });
      }
  
      res.status(201).json({
        success: true,
        message: 'Listing created successfully',
        listing
      });
  
    } catch (error) {
      console.error('Create listing error:', error);
      res.status(500).json({
        error: 'Failed to create listing. Please try again.'
      });
    }
  };

exports.getVendorListings = async (req, res) => {
    try {
      const { status, category, page = 1, limit = 10 } = req.query;
  
      let id=req?.user?._id?req?.user?._id:req.user.id
      const query = { vendor:id };
      
      if (status) query.status = status;
      if (category) query.category = category;
  
      const listings = await Listing.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
  
      const count = await Listing.countDocuments(query);
   
      res.status(200).json({
        success: true,
        listings,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      });
  
    } catch (error) {
      console.error('Get listings error:', error);
      res.status(500).json({
        error: 'Failed to fetch listings'
      });
    }
  };
  

  exports.updateListing = async (req, res) => {
    try {
      const id = req.user._id ? req.user._id : req.user.id;
      
      // Find listing and verify ownership
      const listing = await Listing.findOne({
        _id: req.params.id,
        vendor: id
      });
  
      if (!listing) {
        return res.status(404).json({
          error: 'Listing not found'
        });
      }
  
      // Prepare update data
      const updateData = {
        title: req.body.title,
        category: req.body.category,
        brand: req.body.brand,
        condition: req.body.condition,
        description: req.body.description,
        publishToFeed: req.body.publishToFeed === 'true' || req.body.publishToFeed === true
      };
  
      // Handle pricing
      if (req.body['pricing[rentPrice]'] || req.body['pricing[buyPrice]']) {
        updateData.pricing = {
          rentPrice: parseFloat(req.body['pricing[rentPrice]']) || listing.pricing.rentPrice,
          buyPrice: parseFloat(req.body['pricing[buyPrice]']) || listing.pricing.buyPrice
        };
      }
  
      // Handle location
      if (req.body['availability[location][city]'] || req.body['availability[location][state]'] || req.body['availability[location][zipCode]']) {
        updateData.availability = {
          ...listing.availability,
          location: {
            city: req.body['availability[location][city]'] || listing.availability?.location?.city || '',
            state: req.body['availability[location][state]'] || listing.availability?.location?.state || '',
            zipCode: req.body['availability[location][zipCode]'] || listing.availability?.location?.zipCode || ''
          }
        };
      }
  
      // Handle specifications (Map type)
      const specifications = new Map();
      Object.keys(req.body).forEach(key => {
        if (key.startsWith('specifications[')) {
          const specKey = key.match(/specifications\[(.+)\]/)?.[1];
          if (specKey && req.body[key]) {
            specifications.set(specKey, req.body[key]);
          }
        }
      });
      
      if (specifications.size > 0) {
        updateData.specifications = specifications;
      }
  
      // Handle images
      let updatedImages = [];
  
      // Parse existing images from request
      const existingImagesData = [];
      Object.keys(req.body).forEach(key => {
        if (key.startsWith('existingImages[')) {
          const match = key.match(/existingImages\[(\d+)\]\[(.+)\]/);
          if (match) {
            const index = parseInt(match[1]);
            const field = match[2];
            
            if (!existingImagesData[index]) {
              existingImagesData[index] = {};
            }
            existingImagesData[index][field] = req.body[key];
          }
        }
      });
  
      // Keep existing images that weren't removed
      updatedImages = existingImagesData.filter(img => img && img.url).map(img => ({
        url: img.url,
        publicId: img.publicId || '',
        isPrimary: img.isPrimary === 'true' || img.isPrimary === true
      }));
  
      // Upload new images to Cloudinary
     // Upload new images to Cloudinary
if (req.files && req.files.length > 0) {
    // Check if there's already a primary image in existing images
    const hasPrimaryImage = updatedImages.some(img => img.isPrimary === true);
    
    for (const file of req.files) {
      try {
        // Upload to Cloudinary
        const result = await cloudinaryUploadImage(file.path);
        
        // Add to images array
        updatedImages.push({
          url: result.url,
          publicId: result.public_id,
          isPrimary: !hasPrimaryImage && updatedImages.length === 0 // Only first new image is primary if no existing primary
        });
  
        // Delete local file after upload
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        // Continue with other images even if one fails
      }
    }
  }
  
      // Always update images array (even if empty)
      // This allows users to remove all images if needed
      updateData.images = updatedImages;
  
      console.log(updateData.images)
      // Update the listing
      const updatedListing = await Listing.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );
  
      res.status(200).json({
        success: true,
        message: 'Listing updated successfully',
        data: updatedListing
      });
  
    } catch (error) {
      console.error('Update listing error:', error);
      
      // Clean up uploaded files if there was an error
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
  
      res.status(500).json({
        error: error.message || 'Failed to update listing'
      });
    }
  };



  exports.deleteListing = async (req, res) => {
    try {
      let id = req?.user?._id ? req?.user?._id : req.user.id;
      
      const listing = await Listing.findOne({
        _id: req.params.id,
        vendor: id
      });
  
      if (!listing) {
        return res.status(404).json({
          error: 'Listing not found'
        });
      }
  
      await listing.deleteOne();
  
      // Update vendor stats
      const vendor = await Vendor.findById(id);
      
      if (vendor) {
        vendor.stats.totalListings -= 1;
        if (listing.status === 'active') {
          vendor.stats.activeListings -= 1;
        }
        await vendor.save();
      }
  
      res.status(200).json({
        success: true,
        message: 'Listing deleted successfully'
      });
  
    } catch (error) {
      console.error('Delete listing error:', error);
      res.status(500).json({
        error: 'Failed to delete listing'
      });
    }
  };




exports.updateStatus=async(req,res)=>{
  let {status,id}=req.body;
  try{
await Listing.findByIdAndUpdate(id,{
  $set:{
    status
  }
})

return res.status(200).json({
  message:"Status updated sucessfully"
})

  }catch(e){
    console.log(e.message)
    return res.status(400).json({
      error:"Error while trying to update status"
    })
  }
}



  exports.getDashboardData = async (req, res) => {
    try {
      const vendorId = req.user._id?req.user._id:req.user.id; 
      console.log(vendorId)

      const vendor = await Vendor.findById(vendorId).select('-password');
      
      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }
  
      const requests=await requestModel.find({approvedByVendor:false,status:'pending',vendor:vendorId})
     const messages=await messageModel.find({vendor:vendorId,seenByVendor:false})

      const listings = await Listing.find({ vendor: vendorId });
      
   
      const listingStats = {
        total: listings.length,
        active: listings.filter(l => l.status === 'active').length,
        draft: listings.filter(l => l.status === 'draft').length,
        rented: listings.filter(l => l.status === 'rented').length,
        sold: listings.filter(l => l.status === 'sold').length,
        boosted: listings.filter(l => l.visibility.isBoosted).length
      };
  
    
      const totalEngagement = listings.reduce((acc, listing) => {
        return {
          views: acc.views + listing.engagement.views,
          likes: acc.likes + listing.engagement.likes,
          inquiries: acc.inquiries + listing.engagement.inquiries,
          shares: acc.shares + listing.engagement.shares
        };
      }, { views: 0, likes: 0, inquiries: 0, shares: 0 });
  
   
      const communityPosts = await CommunityPost.find({ 
        vendor: vendorId,
        isActive: true 
      });
  
      const postStats = {
        total: communityPosts.length,
        totalLikes: communityPosts.reduce((sum, post) => sum + post.engagement.likes, 0),
        totalComments: communityPosts.reduce((sum, post) => sum + post.engagement.comments, 0),
        totalShares: communityPosts.reduce((sum, post) => sum + post.engagement.shares, 0)
      };
  
      
      const recentListings = await Listing.find({ vendor: vendorId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title category status pricing.rentPrice pricing.buyPrice engagement createdAt images');
  
     
      const topListings = await Listing.find({ vendor: vendorId })
        .sort({ 'engagement.views': -1 })
        .limit(5)
        .select('title category engagement.views engagement.likes engagement.inquiries');
  
      
      const recentPosts = await CommunityPost.find({ 
        vendor: vendorId,
        isActive: true 
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('type content engagement createdAt')
        .populate('linkedListing', 'title');
  
    
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentActivity = await Listing.find({
        vendor: vendorId,
        updatedAt: { $gte: thirtyDaysAgo }
      }).select('status updatedAt');
  
   
      const dashboardData = {
        success: true,
        data: {
          requests,
          messages,
          vendor: {
            id: vendor._id,
            name: vendor.name,
            email: vendor.email,
            businessName: vendor.businessName,
            subscription: vendor.subscription,
            boostCredits: vendor.boostCredits,
            isVerified: vendor.isVerified
          },
          stats: {
            listings: listingStats,
            engagement: totalEngagement,
            communityPosts: postStats,
            vendorStats: vendor.stats
          },
          recentListings,
          topListings,
          recentPosts,
          recentActivity: recentActivity.length,
          subscriptionStatus: {
            plan: vendor.subscription.plan,
            status: vendor.subscription.status,
            daysRemaining: vendor.subscription.endDate 
              ? Math.ceil((new Date(vendor.subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24))
              : null
          }
        }
      };
  
      res.status(200).json(dashboardData);
  
    } catch (error) {
      console.error('Dashboard data error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching dashboard data',
        error: error.message
      });
    }
  };



  exports.getVendorListingsFeed = async (req, res) => {
    try {
      const vendorId = req.user._id || req.user.id;
      
      // Extract query parameters
      const {
        page = 1,
        limit = 12,
        search = '',
        category = 'all',
        sortBy = 'visibility', // visibility, views, engagement, recent
        status = '' // optional: filter by status
      } = req.query;
  
      // Build query
      let query = { vendor: vendorId };
  
      // Category filter
      if (category && category !== 'all') {
        query.category = category;
      }
  
      // Status filter (optional)
      if (status) {
        query.status = status;
      }
  
      // Search filter
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { brand: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
  
      // Build sort options
      let sortOptions = {};
      switch (sortBy) {
        case 'visibility':
          sortOptions = { 'visibility.visibilityScore': -1, createdAt: -1 };
          break;
        case 'views':
          sortOptions = { 'engagement.views': -1 };
          break;
        case 'engagement':
          // Sort by total engagement (likes + inquiries + shares)
          // Note: MongoDB doesn't support computed sorts directly, so we'll do this in-memory
          sortOptions = { createdAt: -1 }; // Fallback, will sort in-memory later
          break;
        case 'recent':
          sortOptions = { createdAt: -1 };
          break;
        default:
          sortOptions = { 'visibility.visibilityScore': -1, createdAt: -1 };
      }
  
      // Calculate skip value for pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
  
      // Fetch listings
      let listings = await Listing.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .select('title category brand condition pricing description images status visibility engagement availability createdAt updatedAt publishToFeed')
        .lean();
  
      // If sorting by engagement, do it in-memory
      if (sortBy === 'engagement') {
        listings.sort((a, b) => {
          const engagementA = 
            (a.engagement.likes || 0) + 
            (a.engagement.inquiries || 0) + 
            (a.engagement.shares || 0);
          const engagementB = 
            (b.engagement.likes || 0) + 
            (b.engagement.inquiries || 0) + 
            (b.engagement.shares || 0);
          return engagementB - engagementA;
        });
      }
  
      // Get total count for pagination
      const totalListings = await Listing.countDocuments(query);
      const totalPages = Math.ceil(totalListings / parseInt(limit));
      const hasMore = parseInt(page) < totalPages;
  
      // Get summary stats for the vendor
      const allListings = await Listing.find({ vendor: vendorId });
      
      const stats = {
        total: allListings.length,
        active: allListings.filter(l => l.status === 'active').length,
        draft: allListings.filter(l => l.status === 'draft').length,
        rented: allListings.filter(l => l.status === 'rented').length,
        sold: allListings.filter(l => l.status === 'sold').length,
        boosted: allListings.filter(l => l.visibility.isBoosted).length,
        totalViews: allListings.reduce((sum, l) => sum + (l.engagement.views || 0), 0),
        totalEngagement: allListings.reduce((sum, l) => 
          sum + (l.engagement.likes || 0) + 
          (l.engagement.inquiries || 0) + 
          (l.engagement.shares || 0), 0
        )
      };
  
      res.status(200).json({
        success: true,
        data: listings,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalListings,
          limit: parseInt(limit),
          hasMore
        },
        stats,
        filters: {
          search,
          category,
          sortBy,
          status
        }
      });
  
    } catch (error) {
      console.error('Get vendor listings feed error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch listings feed',
        message: error.message
      });
    }
  };

  exports.getListingById = async (req, res) => {
    try {
      const { id } = req.params;
     
      const vendorId = req.user._id || req.user.id;
  
      const listing = await Listing.findOne({ _id: id, vendor: vendorId })
        .populate('vendor', 'name businessName email')
        .lean();
  
      if (!listing) {
        return res.status(404).json({
          success: false,
          error: 'Listing not found'
        });
      }
  
      res.status(200).json({
        success: true,
        data: listing
      });
  
    } catch (error) {
      console.error('Get listing by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch listing',
        message: error.message
      });
    }
  };