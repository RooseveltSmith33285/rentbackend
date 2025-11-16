const mongoose = require('mongoose');

const orderSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'user',
        required: true
    },
    vendor: {
        type: mongoose.Schema.ObjectId,
        ref: 'Vendor',  // or 'vendor' if you have a separate vendor model
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
    
    // 💰 NEW: Payment Split Fields
    platformFee: {
        type: Number,
        required: true,
        default: 0
    },
    vendorPayout: {
        type: Number,
        required: true,
        default: 0
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
    
    // 🔑 NEW: Transfer Management Fields
    transferStatus: {
        type: String,
        enum: ['pending', 'completed', 'cancelled', 'failed'],
        default: 'pending'
    },
    transferAmount: {
        type: Number,  // Amount in cents to transfer to vendor
        default: 0
    },
    transferId: {
        type: String   // Stripe transfer ID
    },
    transferDate: {
        type: Date     // When the transfer was completed
    },
    
    // 💳 NEW: Refund Management Fields
    refundId: {
        type: String   // Stripe refund ID
    },
    refundAmount: {
        type: Number   // Amount refunded in dollars
    },
    refundDate: {
        type: Date     // When the refund was processed
    },
    refundReason: {
        type: String   // Reason for refund
    },
    
    // Order Status
    status: {
        type: String,
        enum: [
            'pending_confirmation',  // NEW: Payment received, waiting for user confirmation
            'confirmed',             // User confirmed, payment can be released
            'processing', 
            'in_transit', 
            'delivered', 
            'active', 
            'paused', 
            'completed', 
            'cancelled',
            'refunded'               // NEW: Order was refunded
        ], 
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
    
    // 📸 NEW: Product Images (from your original code)
    productImages: {
        type: Object,
        default: {}
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

// 🔍 Helper method to check if payment can be released
orderSchema.methods.canReleasePayment = function() {
    return this.transferStatus === 'pending' && 
           this.paymentStatus === 'paid' &&
           this.status !== 'cancelled' &&
           this.status !== 'refunded';
};

// 🔍 Helper method to check if order can be refunded
orderSchema.methods.canRefund = function() {
    return this.transferStatus === 'pending' && 
           this.paymentStatus === 'paid' &&
           !this.refundId;
};

// 📊 Virtual for vendor payout percentage
orderSchema.virtual('vendorPayoutPercentage').get(function() {
    if (!this.totalAmount || this.totalAmount === 0) return 0;
    return ((this.vendorPayout / this.totalAmount) * 100).toFixed(1);
});

// 📊 Virtual for platform fee percentage
orderSchema.virtual('platformFeePercentage').get(function() {
    if (!this.totalAmount || this.totalAmount === 0) return 0;
    return ((this.platformFee / this.totalAmount) * 100).toFixed(1);
});

// Enable virtuals in JSON
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

const orderModel = mongoose.model('order', orderSchema);

module.exports = orderModel;