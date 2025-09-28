const mongoose=require('mongoose')

const orderSchema=mongoose.Schema({
    user:{
type:mongoose.Schema.ObjectId,
ref:'user'
    },
    location:{
        type:[]
    },
    delivery_data:{
type:String,
required:true
    },
    delivery_time:{
type:String,
required:true
    },
    items:{
        type:[{
            type:mongoose.Schema.ObjectId,
            ref:'Product'
        }]
    },
    status: {
        type: String,
        enum: ['active', 'complete', 'paused'], 
        default: 'active'
    },
    subscriptionId:{
        type:String
    },
    comboItem: {
        type: [{
            plugType: String,
            plugDescription: String
        }],
        default: [] 
    },
    createdAt:{
        type:Date
    }
},{timestamps:true})


const orderModel=mongoose.model('order',orderSchema)

module.exports=orderModel