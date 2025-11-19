const Listing=require('../models/listing')
const userModel = require('../models/user')

module.exports.getUserListenings=async(req,res)=>{
    try{
        let id=req?.user?._id?req?.user?._id:req.user.id
        let listenings=await Listing.find({status:{$eq:'active'}}).populate('vendor')
        let user=await userModel.findById(id)

        // Sort listings with boost priority
        const sortedListenings = listenings.sort((a, b) => {
            const now = new Date();
            
            // Check if boost is active and hasn't reached est_reach
            const aBoostActive = a.visibility?.isBoosted && 
                                a.visibility?.boostEndDate && 
                                new Date(a.visibility.boostEndDate) > now &&
                                (a.engagement?.views || 0) < (a.visibility?.est_react || Infinity);
            
            const bBoostActive = b.visibility?.isBoosted && 
                                b.visibility?.boostEndDate && 
                                new Date(b.visibility.boostEndDate) > now &&
                                (b.engagement?.views || 0) < (b.visibility?.est_react || Infinity);
            
            // Get boost amounts (default to 0 if not boosted or expired or reached limit)
            const aBoostAmount = aBoostActive ? (a.visibility?.boostAmount || 0) : 0;
            const bBoostAmount = bBoostActive ? (b.visibility?.boostAmount || 0) : 0;
            
            // Calculate boost priority score based on remaining reach
            const aReachRemaining = aBoostActive 
                ? 1 - ((a.engagement?.views || 0) / (a.visibility?.est_react || 1))
                : 0;
            const bReachRemaining = bBoostActive 
                ? 1 - ((b.engagement?.views || 0) / (b.visibility?.est_react || 1))
                : 0;
            
            const aPriority = aBoostAmount * aReachRemaining;
            const bPriority = bBoostAmount * bReachRemaining;
            
            // Sort by priority (highest first)
            if (bPriority !== aPriority) {
                return bPriority - aPriority;
            }
            
            // If priorities are equal, sort by creation date (newest first)
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        return res.status(200).json({
            listenings: sortedListenings,
            user
        })
    }catch(e){
        console.log(e.message)
        return res.status(400).json({
            error:"Error occured while trying to fetch listenings"
        })
    }
}


module.exports.trackListingView = async (req, res) => {
    try {
        const { listingId } = req.params;
        const userId = req?.user?._id || req.user.id;

        const listing = await Listing.findById(listingId);
        
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        // Increment view count
        listing.engagement.views = (listing.engagement.views || 0) + 1;
        
        // Check if boost reached its estimated reach
        if (listing.visibility?.isBoosted && listing.visibility?.est_react) {
            if (listing.engagement.views >= listing.visibility.est_react) {
                // Mark as reach completed (optional flag)
                listing.visibility.reachCompleted = true;
            }
        }

        await listing.save();

        return res.status(200).json({
            success: true,
            views: listing.engagement.views
        });

    } catch (error) {
        console.error('Track view error:', error);
        return res.status(500).json({
            error: 'Failed to track view'
        });
    }
};