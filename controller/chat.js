const messageModel = require("../models/messages");

exports.sendMessage=async(req,res)=>{
    let {...data}=req.body;
    let id=req?.user?._id?req?.user?._id:req.user.id
    try{
        data={
            ...data,
            user:id,
            sendBy:'user'
        }
let message=await messageModel.create(data)
return res.status(200).json({
    message:"Message sent sucessfully",
id:message._id
})
    }catch(e){
console.log(e.message)
return res.status(400).json({
    error:"Error occured while trying to send message"
})
    }
}

exports.getMessages=async(req,res)=>{
    let {vendor}=req.body;
    try{
        let id=req?.user?._id?req?.user?._id:req.user.id
let messages=await messageModel.find({user:id,vendor})
return res.status(200).json({
    messages
})

    }catch(e){
console.log(e.message)
return res.status(400).json({
    error:"Error occured while trying to fetch messages"
})
    }
}

exports.getConversations=async(req,res)=>{
    try{
        let id=req?.user?._id?req?.user?._id:req.user.id

        let conversations=await messageModel.find({user:id}).populate('vendor')
        return res.status(200).json({
            conversations
        })
    }catch(e){
        console.log(e.message)
        return res.status(400).json({
            error:"Error occured while trying to fetch conversations"
        })
    }
}

exports.getConversation=async(req,res)=>{
    const {vendor}=req.params;
    try{
        let id=req?.user?._id?req?.user?._id:req.user.id
        let conversation=await messageModel.find({user:id,vendor}).populate('vendor')
        return res.status(200).json({
            conversation
        })
    }catch(e){
        console.log(e.message)
        return res.status(400).json({
            error:"Error occured while trying to fetch conversation"
        })
    }

}




module.exports.seenMessages=async(req,res)=>{
    let {vendor}=req.params;
    try{
  let id=req?.user?._id?req?.user?._id:req.user.id
  await messageModel.updateMany({vendor,user:id},{$set:{
  seenByUser:true
  }})
  return res.status(200).json({
    message:"Messages seen sucessfully"
  })
    }catch(e){
      return res.status(400).json({
        error:"Error occured while trying to update messages"
      })
    }
  }