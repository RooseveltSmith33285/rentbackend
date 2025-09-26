const mongoose=require('mongoose')

const userSchema=mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true
    },
mobile:{
    type:String,
    required:true
},
password:{
    type:String,
    required:true
},
paymentMethodToken:{
    type:String
},
customerId:{
    type:String
},
billingPaused:{
    type:Boolean,
    default:false
},
deletedUser:{
    type:Boolean,
    default:false
}
},{
    timestamps:true
})


const userModel=mongoose.model("user",userSchema)

module.exports=userModel