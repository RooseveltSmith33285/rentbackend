const Listing=require('../models/listing')
const userModel = require('../models/user')

module.exports.getUserListenings=async(req,res)=>{
    try{
        let id=req?.user?._id?req?.user?._id:req.user.id
let listenings=await Listing.find({status:{$eq:'active'}}).populate('vendor')
let user=await userModel.findById(id)
return res.status(200).json({
    listenings,
    user
})
    }catch(e){
        console.log(e.message)
        return res.status(400).json({
            error:"Error occured while trying to fetch listenings"
        })
     

    }
}