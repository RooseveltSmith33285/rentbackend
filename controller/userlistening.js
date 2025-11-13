const Listing=require('../models/listing')

module.exports.getUserListenings=async(req,res)=>{
    try{
let listenings=await Listing.find({status:{$eq:'active'}}).populate('vendor')

return res.status(200).json({
    listenings
})
    }catch(e){
        console.log(e.message)
        return res.status(400).json({
            error:"Error occured while trying to fetch listenings"
        })
     

    }
}