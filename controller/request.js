const listing = require("../models/listing");
const orderModel = require("../models/order");
const requestModel = require("../models/request");
const strikeModel = require("../models/strike");
const userModel=require('../models/user')
const Vendor=require('../models/vendor')
exports.sendRequestUser=async(req,res)=>{
    let {listing,vendor,deliveryType,installationType}=req.body;
    console.log(listing)
    console.log(vendor)
try{
await requestModel.create({
    listing,
    vendor,
    user:req.user._id,
    deliveryType,
    installationType

})


return res.status(200).json({
    message:"Requst sent to vendor sucessfully"
})
}catch(e){
 console.log(e.message)
 return res.status(400).json({
    error:"Error while sending request"
 })   
}
}

module.exports.getRequestsUser=async(req,res)=>{
    try{
        let requests = await requestModel.find({
            user: req.user._id,
            $or: [
              { status: 'pending' },
              { status: 'approved' },
              {status:'rejected'}
            ],
            approvedByUser:false
          });
          console.log(requests)
return res.status(200).json({
    requests
})
    }catch(e){
        console.log(e.message)
        return res.status(400).json({
            error:"Error occured while trying to fetch requests"
        })
    }
}


module.exports.rejectOffer=async(req,res)=>{
    let {id}=req.params;
    try{
await requestModel.updateOne({listing:id},{
    $set:{
        status:'rejected'
    }
})

return res.status(200).json({
    message:"Offer rejected sucessfully"
})
    }catch(e){

        console.log(e.message)
        return res.status(400).json({
            error:"Error occured while trying to reject offer"
        })
    }
}




module.exports.rejectRequestOffer=async(req,res)=>{
    let {id}=req.params;
    try{
await requestModel.updateOne({_id:id},{
    $set:{
        status:'rejected'
    }
})

return res.status(200).json({
    message:"Offer rejected sucessfully"
})
    }catch(e){

        console.log(e.message)
        return res.status(400).json({
            error:"Error occured while trying to reject offer"
        })
    }
}

module.exports.getRequestById=async(req,res)=>{
let {id}=req.params
let userId=req?.user?._id?req?.user?._id:req.user.id
    try{
      let user = await userModel.findById(userId).select('credit').lean();
     
      let credits = user?.credit || 0; 
let request=await requestModel.findById(id).populate('user')
.populate('listing')
.populate('vendor');
return res.status(200).json({
    request,
    credits
})
    }catch(e){
        console.log(e.message)
        return res.status(400).json({
            error:"Error occured while fetching request"
        })
    }
}






module.exports.approveOfferByUser = async(req, res) => {
  let { id, totalPrice, paymentMethodId, newCredits, creditsUsed, totalBeforeCredits } = req.body;
  try {
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
    
    let request = await requestModel.findById(id)
      .populate('user')
      .populate({
        path: 'listing',
        populate: { path: 'vendor' }
      });
    
    const vendor = request.listing.vendor;

    if (!vendor || !vendor.stripe_account_id || !vendor.stripe_connect_status) {
      return res.status(400).json({ 
        error: 'Vendor payment setup incomplete' 
      });
    }
    
    let customerId = request.user.stripe_customer_id || request.user.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: request.user.email,
        name: request.user.name || request.user.username,
        metadata: { userId: request.user._id.toString() }
      });
      customerId = customer.id;
      
      await userModel.findByIdAndUpdate(request.user._id, {
        $set: { 
          stripe_customer_id: customerId,
          stripeCustomerId: customerId,
          paymentMethodToken: paymentMethodId,
          credit: newCredits
        }
      }, { new: true });
    } else {
      await userModel.findByIdAndUpdate(request.user._id, {
        $set: { 
          paymentMethodToken: paymentMethodId,
          credit: newCredits 
        }
      });
    }
    
    
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (paymentMethod.customer !== customerId) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId
        });
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId }
        });
      }
    } catch (attachError) {
      console.log('Payment method already attached:', attachError.message);
    }
    
    
    const creditsApplied = creditsUsed || 0;
    let deliveryFeeToCharge = 60;
    let serviceFeeToCharge = 12;
    let monthlyRentToCharge = request.listing.pricing.rentPrice;

    if (creditsApplied > 0) {
     
      let remainingCredits = creditsApplied;
      
   
      if (remainingCredits >= deliveryFeeToCharge) {
        remainingCredits -= deliveryFeeToCharge;
        deliveryFeeToCharge = 0;
      } else {
        deliveryFeeToCharge -= remainingCredits;
        remainingCredits = 0;
      }
      
    
      if (remainingCredits >= serviceFeeToCharge) {
        remainingCredits -= serviceFeeToCharge;
        serviceFeeToCharge = 0;
      } else {
        serviceFeeToCharge -= remainingCredits;
        remainingCredits = 0;
      }
      
  
      if (remainingCredits > 0) {
        monthlyRentToCharge = Math.max(0, monthlyRentToCharge - remainingCredits);
      }
    }

    console.log('💳 Charges after credits:', {
      deliveryFee: deliveryFeeToCharge,
      serviceFee: serviceFeeToCharge,
      monthlyRent: monthlyRentToCharge,
      creditsApplied: creditsApplied,
      totalToCharge: totalPrice
    });
    
  
    const deliveryProduct = await stripe.products.create({
      name: 'Installation & Delivery Fee',
      description: 'One-time installation and delivery service fee'
    });
    
    const serviceProduct = await stripe.products.create({
      name: 'Service Fee',
      description: 'Platform service fee'
    });
    
   
    const addInvoiceItems = [];

    if (deliveryFeeToCharge > 0) {
      const deliveryPrice = await stripe.prices.create({
        product: deliveryProduct.id,
        unit_amount: Math.round(deliveryFeeToCharge * 100),
        currency: 'usd',
      });
      addInvoiceItems.push({ price: deliveryPrice.id });
    }

    if (serviceFeeToCharge > 0) {
      const servicePrice = await stripe.prices.create({
        product: serviceProduct.id,
        unit_amount: Math.round(serviceFeeToCharge * 100),
        currency: 'usd',
      });
      addInvoiceItems.push({ price: servicePrice.id });
    }
    
    const subscriptionPrice = await stripe.prices.create({
      unit_amount: Math.round(monthlyRentToCharge * 100),
      currency: 'usd',
      recurring: { interval: 'month' },
      product_data: {
        name: `Rental: ${request.listing.title}`,
        metadata: {
          listingId: request.listing._id.toString(),
          requestId: id
        }
      }
    });
    
    
    const PLATFORM_FEE_PERCENT = 15;
    const totalAmountCents = Math.round(totalPrice * 100);
    const platformFeeCents = Math.round(totalAmountCents * (PLATFORM_FEE_PERCENT / 100));
    const vendorPayoutCents = totalAmountCents - platformFeeCents;
    
    console.log('💰 Payment split:', {
      totalCharged: totalPrice,
      creditsUsed: creditsApplied,
      originalTotal: totalBeforeCredits || totalPrice,
      platformFee: platformFeeCents / 100,
      vendorPayout: vendorPayoutCents / 100
    });
    
    
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: subscriptionPrice.id }],
      default_payment_method: paymentMethodId,
      add_invoice_items: addInvoiceItems,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        requestId: id,
        userId: request.user._id.toString(),
        listingId: request.listing._id.toString(),
        vendorId: vendor._id.toString(),
        vendorStripeAccountId: vendor.stripe_account_id,
        totalAmount: totalPrice.toString(),
        creditsApplied: creditsApplied.toString(),
        originalTotal: (totalBeforeCredits || totalPrice).toString(),
        platformFee: (platformFeeCents / 100).toString(),
        vendorPayout: (vendorPayoutCents / 100).toString(),
        transferStatus: 'pending'
      }
    });
    
    let paymentIntent = subscription.latest_invoice.payment_intent;
    
    console.log('📋 Initial Payment Intent Status:', paymentIntent.status);
    
  
    if (paymentIntent.status === 'requires_confirmation') {
      paymentIntent = await stripe.paymentIntents.confirm(paymentIntent.id, {
        payment_method: paymentMethodId
      });
    }
    
    if (paymentIntent.status === 'requires_action') {
      return res.status(200).json({
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        subscriptionId: subscription.id,
        message: 'Payment requires additional authentication'
      });
    }
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Payment not completed',
        status: paymentIntent.status
      });
    }
    
    console.log('✅ Payment successful - money held in platform account');
    
   
    await requestModel.findByIdAndUpdate(id, {
      $set: {
        approvedByUser: true,
        paymentStatus: 'paid',
        paymentIntentId: paymentIntent.id,
        subscriptionId: subscription.id,
        status: 'pending_confirmation',
        totalAmount: totalPrice,
        creditsUsed: creditsApplied,
        originalTotal: totalBeforeCredits || totalPrice,
        platformFee: platformFeeCents / 100,
        vendorPayout: vendorPayoutCents / 100,
        transferStatus: 'pending',
        transferAmount: vendorPayoutCents
      }
    });
    
    const order = await orderModel.create({
      user: request.user._id,
      vendor: vendor._id,
      listing: request.listing._id,
      request: id,
      deliveryType: request.deliveryType,
      installationType: request.installationType,
      deliveryAddress: request.deliveryAddress,
      deliveryDate: request.deliveryDate || new Date(),
      deliveryTime: request.deliveryTime || 'TBD',
      monthlyRent: request.listing.pricing.rentPrice,
      deliveryFee: 60,
      serviceFee: 12,
      totalAmount: totalPrice,
      creditsUsed: creditsApplied,
      originalTotal: totalBeforeCredits || totalPrice,
      platformFee: platformFeeCents / 100,
      vendorPayout: vendorPayoutCents / 100,
      paymentIntentId: paymentIntent.id,
      paymentStatus: 'paid',
      paymentMethod: paymentMethodId,
      status: 'processing',
      subscriptionId: subscription.id,
      productImages: request.images && request.images[0] ? request.images[0] : {},
      rentalStartDate: new Date(),
      transferStatus: 'pending',
      transferAmount: vendorPayoutCents
    });
    
    await listing.findByIdAndUpdate(request.listing._id, {
      $set: {
        status: 'sold'
      }
    });
    
    return res.status(200).json({
      success: true,
      message: "Payment received. Funds will be released to vendor after confirmation.",
      paymentIntentId: paymentIntent.id,
      subscriptionId: subscription.id,
      orderId: order._id,
      status: paymentIntent.status,
      transferStatus: 'pending',
      paymentSplit: {
        totalCharged: totalPrice,
        creditsUsed: creditsApplied,
        originalTotal: totalBeforeCredits || totalPrice,
        platformFee: platformFeeCents / 100,
        vendorPayout: vendorPayoutCents / 100,
        note: 'Vendor payout held until confirmation'
      }
    });
    
  } catch(e) {
    console.log('Payment error:', e.message);
    console.error('Full error:', e);
    return res.status(400).json({
      error: "Error occurred while processing payment: " + e.message
    });
  }
};






module.exports.releasePaymentToVendor = async(req, res) => {
  const { orderId } = req.body;
  
  try {
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
  
    let order = await orderModel.findById(orderId)
      .populate('vendor')
      .populate('request');

      
    
      const requestId=order.request._id.toString()
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    
    if (order.transferStatus === 'completed') {
      return res.status(400).json({ 
        error: 'Payment already released to vendor' 
      });
    }
    
    const vendor = order.vendor;
    const transferAmountCents = order.transferAmount || order.vendorPayout * 100;
    
    console.log('💸 Transferring to vendor:', {
      vendorId: vendor._id,
      stripeAccountId: vendor.stripe_account_id,
      amount: transferAmountCents / 100
    });
    
    
    const transfer = await stripe.transfers.create({
      amount: Math.round(transferAmountCents),
      currency: 'usd',
      destination: vendor.stripe_account_id,
      description: `Payout for order ${order._id}`,
      metadata: {
        orderId: order._id.toString(),
        requestId: requestId || order.request.toString(),
        vendorId: vendor._id.toString(),
        subscriptionId: order.subscriptionId
      }
    });
    
    console.log('✅ Transfer successful:', transfer.id);

    await orderModel.findByIdAndUpdate(orderId, {
      $set: {
        transferStatus: 'completed',
        transferId: transfer.id,
        transferDate: new Date(),
        status: 'confirmed'
      }
    });
    
  
    if (requestId) {
      await requestModel.findByIdAndUpdate(requestId, {
        $set: {
          transferStatus: 'completed',
          transferId: transfer.id,
          status: 'confirmed'
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Payment successfully released to vendor',
      transferId: transfer.id,
      amount: transferAmountCents / 100,
      vendor: {
        id: vendor._id,
        name: vendor.name || vendor.username
      }
    });
    
  } catch(e) {
    console.log('Transfer error:', e.message);
    console.log('Full error:', e);
    
    return res.status(400).json({
      error: 'Failed to release payment to vendor: ' + e.message
    });
  }
};

module.exports.refundHeldPayment = async(req, res) => {
  const { orderId } = req.body;
  
  try {
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
    
    let order = await orderModel.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
   
    if (order.transferStatus === 'completed') {
      return res.status(400).json({ 
        error: 'Cannot refund - payment already released to vendor' 
      });
    }
    
   
    if (order.subscriptionId) {
      await stripe.subscriptions.cancel(order.subscriptionId);
    }
    
 
    const refund = await stripe.refunds.create({
      payment_intent: order.paymentIntentId,
      reason: 'requested_by_customer',
      metadata: {
        orderId: order._id.toString()
      }
    });
    
    console.log('✅ Refund successful:', refund.id);
    
   
    await orderModel.findByIdAndUpdate(orderId, {
      $set: {
        status: 'refunded',
        transferStatus: 'cancelled',
        refundId: refund.id,
        refundDate: new Date()
      }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Payment refunded successfully',
      refundId: refund.id,
      amount: refund.amount / 100
    });
    
  } catch(e) {
    console.log('Refund error:', e.message);
    return res.status(400).json({
      error: 'Failed to refund payment: ' + e.message
    });
  }
};



module.exports.rejectDeliveryAndInstallation = async(req, res) => {
  const { orderId, reason } = req.body;
  const userId = req?.user?._id ? req.user._id : req.user.id;
  
  try {
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
    
    
    const order = await orderModel.findById(orderId)
      .populate('user')
      .populate('vendor')
      .populate('listing')
      .populate('request');
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }
    
  
    if (order.user._id.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'Unauthorized: You do not own this order' 
      });
    }
    
   
    if (order.status !== 'processing' && order.status !== 'pending_confirmation') {
      return res.status(400).json({ 
        success: false,
        error: `Order cannot be rejected at this stage. Current status: ${order.status}`,
        currentStatus: order.status
      });
    }
   
    if (order.transferStatus === 'completed') {
      return res.status(400).json({ 
        success: false,
        error: 'Funds have already been transferred to vendor. Please contact support.',
        transferStatus: 'completed'
      });
    }
    
 
    if (order.rejectedAt) {
      return res.status(400).json({ 
        success: false,
        error: 'This order has already been rejected',
        rejectedAt: order.rejectedAt
      });
    }
    
    console.log('🚫 Processing delivery rejection:', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      reason,
      subscriptionId: order.subscriptionId,
      paymentIntentId: order.paymentIntentId,
      totalAmount: order.totalAmount,
      user: order.user.name || order.user.username,
      vendor: order.vendor._id
    });
    
   
    if (order.subscriptionId) {
      try {
        const cancelledSubscription = await stripe.subscriptions.cancel(order.subscriptionId, {
          prorate: false,
          invoice_now: false
        });
        console.log('✅ Subscription cancelled:', {
          subscriptionId: order.subscriptionId,
          status: cancelledSubscription.status
        });
      } catch (subError) {
        console.log('⚠️ Subscription cancellation error:', subError.message);
       
        if (!subError.message.includes('No such subscription')) {
          
          console.error('Subscription cancel error details:', subError);
        }
      }
    }
    

    const monthlyRent = parseFloat(order.monthlyRent || 0);
    const deliveryFee = parseFloat(order.deliveryFee || 0);
    const serviceFee = parseFloat(order.serviceFee || 0);
    
 
    const creditAmount = monthlyRent + deliveryFee;
   
    const platformRetains = serviceFee;
    
    console.log('💰 Financial breakdown:', {
      totalPaid: order.totalAmount,
      creditToUser: creditAmount,
      platformKeeps: platformRetains,
      breakdown: {
        monthlyRent: monthlyRent,
        deliveryFee: deliveryFee,
        serviceFee: serviceFee
      }
    });
    
    
    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      {
        $inc: { credit: creditAmount }
      },
      { new: true }
    );
    
    if (!updatedUser) {
      throw new Error('Failed to update user credit balance');
    }
    
    console.log('✅ Credit added to user account:', {
      userId: userId,
      userName: updatedUser.name || updatedUser.username,
      creditAdded: creditAmount,
      previousBalance: (parseFloat(updatedUser.credit) - creditAmount).toFixed(2),
      newBalance: updatedUser.credit
    });
    
    
    try {
      const strike = await strikeModel.create({
        vendorId: order.vendor._id,
        orderId: order._id,
        disposition: `Delivery rejected by renter. Reason: ${reason}. Credit issued: $${creditAmount.toFixed(2)}`
      });
      
      console.log('⚠️ Vendor strike created:', {
        strikeId: strike._id,
        vendorId: order.vendor._id,
        orderId: order._id
      });
    } catch (strikeError) {
      console.error('Failed to create vendor strike:', strikeError.message);
     
    }
    
 
    const updatedOrder = await orderModel.findByIdAndUpdate(
      orderId,
      {
        $set: {
          status: 'cancelled',
          transferStatus: 'cancelled',
          rejectionReason: reason,
          rejectedAt: new Date(),
          rejectedBy: userId,
          refundStatus: 'credited',
          refundAmount: creditAmount,
          platformRetainedAmount: platformRetains,
          refundMethod: 'account_credit',
          cancelled_reason: `Delivery rejected by user: ${reason}`
        }
      },
      { new: true }
    );
    
    console.log('✅ Order updated:', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      newStatus: updatedOrder.status,
      refundStatus: updatedOrder.refundStatus
    });
    
   
    if (order.request) {
      await requestModel.findByIdAndUpdate(
        order.request._id || order.request,
        {
          $set: {
            status: 'rejected',
            rejectionReason: reason,
            rejectedAt: new Date()
          }
        }
      );
      console.log('✅ Request updated to rejected status');
    }
    
   
    if (order.listing) {
      await listing.findByIdAndUpdate(
        order.listing._id,
        {
          $set: {
            status: 'active'
          }
        }
      );
      console.log('✅ Listing status updated to available:', order.listing.title);
    }
    
    
    console.log('📊 Transaction completed:', {
      action: 'rejection',
      orderId: order._id,
      orderNumber: order.orderNumber,
      user: updatedUser.name || updatedUser.username,
      vendor: order.vendor._id,
      creditAdded: creditAmount,
      platformRetained: platformRetains,
      strikeIssued: true,
      reason: reason,
      timestamp: new Date().toISOString()
    });
    

    
    return res.status(200).json({
      success: true,
      message: 'Delivery rejected successfully. Credit has been added to your account.',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderStatus: 'cancelled',
        creditDetails: {
          creditAdded: creditAmount,
          previousBalance: (parseFloat(updatedUser.credit) - creditAmount).toFixed(2),
          newCreditBalance: parseFloat(updatedUser.credit).toFixed(2),
          platformRetained: platformRetains,
          reason: reason,
          note: 'Credit can be used for future rentals'
        },
        refundDetails: {
          method: 'account_credit',
          status: 'credited',
          processedAt: new Date().toISOString()
        },
        vendorPenalty: {
          strikeIssued: true,
          reason: 'Failed delivery'
        }
      }
    });
    
  } catch(e) {
    console.error('❌ Reject delivery error:', {
      error: e.message,
      stack: e.stack,
      orderId: req.body.orderId,
      userId: userId
    });
    
    return res.status(500).json({
      success: false,
      error: "An error occurred while rejecting the delivery",
      message: e.message,
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
};