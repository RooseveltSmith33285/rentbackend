const cron = require('node-cron');
const Listing = require('../models/listing'); 


const removeExpiredBoosts = async () => {
  try {
    const now = new Date();
    
    console.log('🔍 Checking for expired boosts at:', now.toISOString());
    

    const expiredListings = await Listing.find({
      'visibility.isBoosted': true,
      'visibility.boostEndDate': { $lte: now } 
    }).select('_id title brand category visibility vendor');
    
    if (expiredListings.length === 0) {
      console.log('✅ No expired boosts found');
      return {
        success: true,
        updated: 0,
        message: 'No expired boosts to remove'
      };
    }
    
    console.log(`📋 Found ${expiredListings.length} listings with expired boosts`);
    
  
    expiredListings.forEach((listing, index) => {
      const expired = Math.floor((now - new Date(listing.visibility.boostEndDate)) / (1000 * 60 * 60 * 24));
      console.log(`  ${index + 1}. "${listing.title}" (${listing.brand})`);
      console.log(`     Category: ${listing.category}`);
      console.log(`     Boost: ${listing.visibility.boostAmount}`);
      console.log(`     Expired: ${expired} day(s) ago`);
      console.log(`     ID: ${listing._id}\n`);
    });
    
   
    const result = await Listing.updateMany(
      {
        'visibility.isBoosted': true,
        'visibility.boostEndDate': { $lte: now }
      },
      {
        $set: {
          'visibility.isBoosted': false,
          'visibility.boostAmount': 0,
          'visibility.boostEndDate': null,
          
        }
      }
    );
    
    console.log(`✅ Successfully removed boost from ${result.modifiedCount} listings`);
    
    return {
      success: true,
      updated: result.modifiedCount,
      listings: expiredListings.map(l => ({
        id: l._id,
        title: l.title,
        brand: l.brand,
        category: l.category,
        boostAmount: l.visibility.boostAmount,
        expiredDate: l.visibility.boostEndDate
      }))
    };
    
  } catch (error) {
    console.error('❌ Error removing expired boosts:', error);
    return {
      success: false,
      error: error.message
    };
  }
};


module.exports.scheduleBoostExpiryCheck = () => {

    cron.schedule('* * * * *', async () => {
    console.log('⏰ Running daily boost expiry check...');
    await removeExpiredBoosts();
  }, {
    scheduled: true,
    timezone: "America/New_York" 
  });
  
  console.log('✅ Boost expiry cron job scheduled (runs daily at midnight)');
};

