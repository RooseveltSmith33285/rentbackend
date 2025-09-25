const mongoose = require('mongoose')

const cartSchema = mongoose.Schema({
    items: {
        type: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Product'
        }],
        default: [] // Set default as empty array
    },
    comboItem: {
        type: [{
            plugType: String,
            plugDescription: String
        }],
        default: [] // Set default as empty array
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'user'
    }
})

const cartModel = mongoose.model('cart', cartSchema)

module.exports = cartModel;