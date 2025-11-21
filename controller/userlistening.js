const Listing=require('../models/listing')
const userModel = require('../models/user')

module.exports.getUserListenings=async(req,res)=>{
    try{
        let id=req?.user?._id?req?.user?._id:req.user.id
        let listenings=await Listing.find({status:{$eq:'active'}}).populate('vendor')
        let user=await userModel.findById(id)

  
        const sortedListenings = listenings.sort((a, b) => {
            const now = new Date();
            
           
            const aBoostActive = a.visibility?.isBoosted && 
                                a.visibility?.boostEndDate && 
                                new Date(a.visibility.boostEndDate) > now &&
                                (a.engagement?.views || 0) < (a.visibility?.est_react || Infinity);
            
            const bBoostActive = b.visibility?.isBoosted && 
                                b.visibility?.boostEndDate && 
                                new Date(b.visibility.boostEndDate) > now &&
                                (b.engagement?.views || 0) < (b.visibility?.est_react || Infinity);
            
        
            const aBoostAmount = aBoostActive ? (a.visibility?.boostAmount || 0) : 0;
            const bBoostAmount = bBoostActive ? (b.visibility?.boostAmount || 0) : 0;
            
           
            const aReachRemaining = aBoostActive 
                ? 1 - ((a.engagement?.views || 0) / (a.visibility?.est_react || 1))
                : 0;
            const bReachRemaining = bBoostActive 
                ? 1 - ((b.engagement?.views || 0) / (b.visibility?.est_react || 1))
                : 0;
            
            const aPriority = aBoostAmount * aReachRemaining;
            const bPriority = bBoostAmount * bReachRemaining;
            
        
            if (bPriority !== aPriority) {
                return bPriority - aPriority;
            }
            
           
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


        listing.engagement.views = (listing.engagement.views || 0) + 1;
        
      
        if (listing.visibility?.isBoosted && listing.visibility?.est_react) {
            if (listing.engagement.views >= listing.visibility.est_react) {
               
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