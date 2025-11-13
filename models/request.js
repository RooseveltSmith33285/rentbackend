const mongoose=require('mongoose')

const requestSchema=mongoose.Schema({
    user:{
        type:mongoose.Schema.ObjectId,
        ref:'user'
    },
    deliveryType:{
type:String
    },
    installationType:{
type:String
    },
    images: [{
        front: String,
        side: String,
        serial_tag: String,
        condition: String
      }],
      approvedByVendor:{
type:Boolean,
default:false
      },

    approvedByUser:{
type:Boolean,
default:false
    },
    vendor:{
        type:mongoose.Schema.ObjectId,
        ref:'Vendor'
    },
    listing:{
type:mongoose.Schema.ObjectId,
ref:'Listing'
    },
    status:{
        type:String,
        enum:['approved','rejected','pending'],
        default:'pending'
    }
},{timestamps:true})


const requestModel=mongoose.model('request',requestSchema)

module.exports=requestModel