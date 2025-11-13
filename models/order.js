const mongoose = require('mongoose');

const orderSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'user',
        required: true
    },
    listing: {
        type: mongoose.Schema.ObjectId,
        ref: 'Listing',
        required: true
    },
    request: {
        type: mongoose.Schema.ObjectId,
        ref: 'request',
        required: true
    },
    // Delivery Information
    deliveryType: {
        type: String,
       
        required: true
    },
    installationType: {
        type: String,
        
    },
    deliveryAddress: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
    },
    deliveryDate: {
        type: Date,
        required: true
    },
    deliveryTime: {
        type: String,
        required: true
    },
    
    // Pricing
    monthlyRent: {
        type: Number,
        required: true
    },
    deliveryFee: {
        type: Number,
        default: 60
    },
    serviceFee: {
        type: Number,
        default: 12
    },
    totalAmount: {
        type: Number,
        required: true
    },
    
    // Payment Information
    paymentIntentId: {
        type: String,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['paid', 'pending', 'failed', 'refunded'],
        default: 'paid'
    },
    paymentMethod: {
        type: String
    },
    
    // Order Status
    status: {
        type: String,
        enum: ['confirmed', 'processing', 'in_transit', 'delivered', 'active', 'paused', 'completed', 'cancelled'], 
        default: 'confirmed'
    },
    
    // Rental Information
    rentalStartDate: {
        type: Date
    },
    rentalEndDate: {
        type: Date
    },
    subscriptionId: {
        type: String
    },
    

    
    // Additional Notes
    notes: {
        type: String
    },
    
    // Tracking
    trackingNumber: {
        type: String
    },
    
    orderNumber: {
        type: String,
        unique: true
    }
    
}, { timestamps: true });

// Generate order number before saving
orderSchema.pre('save', async function(next) {
    if (!this.orderNumber) {
        this.orderNumber = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }
    next();
});

const orderModel = mongoose.model('order', orderSchema);

module.exports = orderModel;