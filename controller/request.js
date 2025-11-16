const orderModel = require("../models/order");
const requestModel = require("../models/request");
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
              { status: 'approved' }
            ],
            approvedByUser:false
          });
          
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
    try{
let request=await requestModel.findById(id).populate('user')
.populate('listing')
.populate('vendor');
return res.status(200).json({
    request
})
    }catch(e){
        console.log(e.message)
        return res.status(400).json({
            error:"Error occured while fetching request"
        })
    }
}


// module.exports.approveOfferByUser = async(req, res) => {
//     let { id, totalPrice, paymentMethodId } = req.body;
//     try {
//       const stripe = require('stripe')(process.env.STRIPE_LIVE);
//       let request = await requestModel.findById(id).populate('user').populate('listing');
      
//       // Step 1: Create or retrieve Stripe customer
//       let customerId = request.user.stripeCustomerId;
      
//       if (!customerId) {
//         const customer = await stripe.customers.create({
//           email: request.user.email,
//           name: request.user.name || request.user.username,
//           metadata: {
//             userId: request.user._id.toString()
//           }
//         });
//         customerId = customer.id;
        
//         // Save customer ID to user
//         await userModel.findByIdAndUpdate(request.user._id, {
//           $set: { stripeCustomerId: customerId }
//         });
//       }
      
//       // Step 2: Attach payment method to customer (if not already attached)
//       try {
//         const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        
//         if (paymentMethod.customer !== customerId) {
//           await stripe.paymentMethods.attach(paymentMethodId, {
//             customer: customerId
//           });
          
//           // Set as default payment method
//           await stripe.customers.update(customerId, {
//             invoice_settings: {
//               default_payment_method: paymentMethodId
//             }
//           });
//         }
//       } catch (attachError) {
//         console.log('Payment method already attached or error:', attachError.message);
//       }
      
//       // Step 3: Create products and prices for one-time fees
//       const deliveryProduct = await stripe.products.create({
//         name: 'Installation & Delivery Fee',
//         description: 'One-time installation and delivery service fee'
//       });
      
//       const serviceProduct = await stripe.products.create({
//         name: 'Service Fee',
//         description: 'Platform service fee'
//       });
      
//       const deliveryPrice = await stripe.prices.create({
//         product: deliveryProduct.id,
//         unit_amount: 6000, // $60 in cents
//         currency: 'usd',
//       });
      
//       const servicePrice = await stripe.prices.create({
//         product: serviceProduct.id,
//         unit_amount: 1200, // $12 in cents
//         currency: 'usd',
//       });
      
//       // Step 4: Create subscription price
//       const subscriptionPrice = await stripe.prices.create({
//         unit_amount: Math.round(request.listing.pricing.rentPrice * 100),
//         currency: 'usd',
//         recurring: {
//           interval: 'month'
//         },
//         product_data: {
//           name: `Rental: ${request.listing.title}`,
//           metadata: {
//             listingId: request.listing._id.toString(),
//             requestId: id
//           }
//         }
//       });
      
//       // Step 5: Create subscription with automatic payment
//       const subscription = await stripe.subscriptions.create({
//         customer: customerId,
//         items: [{
//           price: subscriptionPrice.id
//         }],
//         default_payment_method: paymentMethodId,
//         add_invoice_items: [
//           {
//             price: deliveryPrice.id
//           },
//           {
//             price: servicePrice.id
//           }
//         ],      
//         payment_behavior: 'default_incomplete',
//         payment_settings: {
//           payment_method_types: ['card'],
//           save_default_payment_method: 'on_subscription'
//         },
//         expand: ['latest_invoice.payment_intent'],
//         metadata: {
//           requestId: id,
//           userId: request.user._id.toString(),
//           listingId: request.listing._id.toString(),
//           totalAmount: totalPrice.toString()
//         }
//       });
      
//       const paymentIntent = subscription.latest_invoice.payment_intent;
      
//       console.log('Payment Intent Status:', paymentIntent.status);
//       console.log('Subscription Status:', subscription.status);
      
//       // Helper function to update request and create order
//       const completeOrder = async () => {
//         await requestModel.findByIdAndUpdate(id, {
//           $set: {
//             approvedByUser: true,
//             paymentStatus: 'paid',
//             paymentIntentId: paymentIntent.id,
//             subscriptionId: subscription.id,
//             status: 'confirmed',
//             totalAmount: totalPrice
//           }
//         });
        
//         const order = await orderModel.create({
//           user: request.user._id,
//           listing: request.listing._id,
//           request: id,
//           deliveryType: request.deliveryType,
//           installationType: request.installationType,
//           deliveryAddress: request.deliveryAddress,
//           deliveryDate: request.deliveryDate || new Date(),
//           deliveryTime: request.deliveryTime || 'TBD',
//           monthlyRent: request.listing.pricing.rentPrice,
//           deliveryFee: 60,
//           serviceFee: 12,
//           totalAmount: totalPrice,
//           paymentIntentId: paymentIntent.id,
//           paymentStatus: 'paid',
//           paymentMethod: paymentMethodId,
//           status: 'confirmed',
//           subscriptionId: subscription.id,
//           productImages: request.images && request.images[0] ? request.images[0] : {},
//           rentalStartDate: new Date()
//         });
        
//         return order;
//       };
      
//       // Step 6: Handle different payment intent statuses
    
//           const order = await completeOrder();
          
//           return res.status(200).json({
//             message: "Payment successful and subscription created",
//             paymentIntentId: paymentIntent.id,
//             subscriptionId: subscription.id,
//             orderId: order._id,
//             status: paymentIntent.status
//           });
          
       
      
//     } catch(e) {
//       console.log('Payment error:', e.message);
//       console.log('Full error:', e);
//       return res.status(400).json({
//         error: "Error occurred while processing payment: " + e.message
//       });
//     }
//   }







module.exports.approveOfferByUser = async(req, res) => {
  let { id, totalPrice, paymentMethodId } = req.body;
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
          paymentMethodToken: paymentMethodId
        }
      }, { new: true });
    } else {
      await userModel.findByIdAndUpdate(request.user._id, {
        $set: { paymentMethodToken: paymentMethodId }
      });
    }
    
    // Attach payment method
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
    
    // Create products and prices
    const deliveryProduct = await stripe.products.create({
      name: 'Installation & Delivery Fee',
      description: 'One-time installation and delivery service fee'
    });
    
    const serviceProduct = await stripe.products.create({
      name: 'Service Fee',
      description: 'Platform service fee'
    });
    
    const deliveryPrice = await stripe.prices.create({
      product: deliveryProduct.id,
      unit_amount: 6000,
      currency: 'usd',
    });
    
    const servicePrice = await stripe.prices.create({
      product: serviceProduct.id,
      unit_amount: 1200,
      currency: 'usd',
    });
    
    const subscriptionPrice = await stripe.prices.create({
      unit_amount: Math.round(request.listing.pricing.rentPrice * 100),
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
    
    // Calculate split
    const PLATFORM_FEE_PERCENT = 15;
    const totalAmountCents = Math.round(totalPrice * 100);
    const platformFeeCents = Math.round(totalAmountCents * (PLATFORM_FEE_PERCENT / 100));
    const vendorPayoutCents = totalAmountCents - platformFeeCents;
    
    console.log('💰 Payment split:', {
      total: totalPrice,
      platformFee: platformFeeCents / 100,
      vendorPayout: vendorPayoutCents / 100
    });
    
    // 🔑 KEY CHANGE: Create subscription WITHOUT transfer_data
    // Money stays in your platform account until you manually transfer it
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: subscriptionPrice.id }],
      default_payment_method: paymentMethodId,
      add_invoice_items: [
        { price: deliveryPrice.id },
        { price: servicePrice.id }
      ],
      // ❌ REMOVE: application_fee_percent and transfer_data
      // Money will be held in your platform account
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
        vendorStripeAccountId: vendor.stripe_account_id, // Store for later transfer
        totalAmount: totalPrice.toString(),
        platformFee: (platformFeeCents / 100).toString(),
        vendorPayout: (vendorPayoutCents / 100).toString(),
        transferStatus: 'pending' // Track transfer status
      }
    });
    
    let paymentIntent = subscription.latest_invoice.payment_intent;
    
    console.log('📋 Initial Payment Intent Status:', paymentIntent.status);
    
    // Confirm payment intent
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
    
    // Update request with pending transfer status
    await requestModel.findByIdAndUpdate(id, {
      $set: {
        approvedByUser: true,
        paymentStatus: 'paid',
        paymentIntentId: paymentIntent.id,
        subscriptionId: subscription.id,
        status: 'pending_confirmation', // User needs to confirm
        totalAmount: totalPrice,
        platformFee: platformFeeCents / 100,
        vendorPayout: vendorPayoutCents / 100,
        transferStatus: 'pending', // Track that money hasn't been transferred yet
        transferAmount: vendorPayoutCents // Store amount to transfer later
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
      platformFee: platformFeeCents / 100,
      vendorPayout: vendorPayoutCents / 100,
      paymentIntentId: paymentIntent.id,
      paymentStatus: 'paid',
      paymentMethod: paymentMethodId,
      status: 'pending_confirmation', // Waiting for user confirmation
      subscriptionId: subscription.id,
      productImages: request.images && request.images[0] ? request.images[0] : {},
      rentalStartDate: new Date(),
      transferStatus: 'pending', // Money not transferred yet
      transferAmount: vendorPayoutCents
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
        total: totalPrice,
        platformFee: platformFeeCents / 100,
        vendorPayout: vendorPayoutCents / 100,
        note: 'Vendor payout held until confirmation'
      }
    });
    
  } catch(e) {
    console.log('Payment error:', e.message);
    return res.status(400).json({
      error: "Error occurred while processing payment: " + e.message
    });
  }
};




module.exports.releasePaymentToVendor = async(req, res) => {
  const { orderId, requestId } = req.body;
  
  try {
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
    
    // Get the order/request with vendor info
    let order = await orderModel.findById(orderId)
      .populate('vendor')
      .populate('request');
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check if already transferred
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
    
    // Create transfer to vendor's connected account
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
    
    // Update order status
    await orderModel.findByIdAndUpdate(orderId, {
      $set: {
        transferStatus: 'completed',
        transferId: transfer.id,
        transferDate: new Date(),
        status: 'confirmed' // Now fully confirmed
      }
    });
    
    // Update request if provided
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
    
    // Check if money was already transferred
    if (order.transferStatus === 'completed') {
      return res.status(400).json({ 
        error: 'Cannot refund - payment already released to vendor' 
      });
    }
    
    // Cancel subscription first
    if (order.subscriptionId) {
      await stripe.subscriptions.cancel(order.subscriptionId);
    }
    
    // Refund the payment intent
    const refund = await stripe.refunds.create({
      payment_intent: order.paymentIntentId,
      reason: 'requested_by_customer',
      metadata: {
        orderId: order._id.toString()
      }
    });
    
    console.log('✅ Refund successful:', refund.id);
    
    // Update order
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