const mongoose=require('mongoose')

const cartSchema=mongoose.Schema({
    items:{
        type:[{
            type:mongoose.Schema.ObjectId,
            ref:'Product'
        }]
    },

    user:{
        type:mongoose.Schema.ObjectId,
        ref:'user'
    }
})

const cartModel=mongoose.model('cart',cartSchema)

module.exports=cartModel;