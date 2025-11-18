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
    
    // Calculate what needs to be charged after credits
    const creditsApplied = creditsUsed || 0;
    let deliveryFeeToCharge = 60;
    let serviceFeeToCharge = 12;
    let monthlyRentToCharge = request.listing.pricing.rentPrice;

    if (creditsApplied > 0) {
      // Credits cover fees first, then rent
      let remainingCredits = creditsApplied;
      
      // Apply to delivery fee first
      if (remainingCredits >= deliveryFeeToCharge) {
        remainingCredits -= deliveryFeeToCharge;
        deliveryFeeToCharge = 0;
      } else {
        deliveryFeeToCharge -= remainingCredits;
        remainingCredits = 0;
      }
      
      // Apply to service fee
      if (remainingCredits >= serviceFeeToCharge) {
        remainingCredits -= serviceFeeToCharge;
        serviceFeeToCharge = 0;
      } else {
        serviceFeeToCharge -= remainingCredits;
        remainingCredits = 0;
      }
      
      // Apply to monthly rent
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
    
    // Create products
    const deliveryProduct = await stripe.products.create({
      name: 'Installation & Delivery Fee',
      description: 'One-time installation and delivery service fee'
    });
    
    const serviceProduct = await stripe.products.create({
      name: 'Service Fee',
      description: 'Platform service fee'
    });
    
    // Only create price items if they have a value > 0
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
    
    // Calculate split based on ACTUAL amount charged (after credits)
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
    
    // Create subscription with adjusted amounts
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: subscriptionPrice.id }],
      default_payment_method: paymentMethodId,
      add_invoice_items: addInvoiceItems, // Only includes items > $0
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



// module.exports.approveOfferByUser = async(req, res) => {
//   let { id, totalPrice, paymentMethodId,newCredits } = req.body;
//   try {
//     const stripe = require('stripe')(process.env.STRIPE_LIVE);
    
//     let request = await requestModel.findById(id)
//       .populate('user')
//       .populate({
//         path: 'listing',
//         populate: { path: 'vendor' }
//       });
    
//     const vendor = request.listing.vendor;

//     if (!vendor || !vendor.stripe_account_id || !vendor.stripe_connect_status) {
//       return res.status(400).json({ 
//         error: 'Vendor payment setup incomplete' 
//       });
//     }
    
//     let customerId = request.user.stripe_customer_id || request.user.stripeCustomerId;
    
//     if (!customerId) {
//       const customer = await stripe.customers.create({
//         email: request.user.email,
//         name: request.user.name || request.user.username,
//         metadata: { userId: request.user._id.toString() }
//       });
//       customerId = customer.id;
      
//       await userModel.findByIdAndUpdate(request.user._id, {
//         $set: { 
//           stripe_customer_id: customerId,
//           stripeCustomerId: customerId,
//           paymentMethodToken: paymentMethodId,
//           credit:newCredits
//         }
//       }, { new: true });
//     } else {
//       await userModel.findByIdAndUpdate(request.user._id, {
//         $set: { paymentMethodToken: paymentMethodId,credit:newCredits }
//       });
//     }
    
//     // Attach payment method
//     try {
//       const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
//       if (paymentMethod.customer !== customerId) {
//         await stripe.paymentMethods.attach(paymentMethodId, {
//           customer: customerId
//         });
//         await stripe.customers.update(customerId, {
//           invoice_settings: { default_payment_method: paymentMethodId }
//         });
//       }
//     } catch (attachError) {
//       console.log('Payment method already attached:', attachError.message);
//     }
    
//     // Create products and prices
//     const deliveryProduct = await stripe.products.create({
//       name: 'Installation & Delivery Fee',
//       description: 'One-time installation and delivery service fee'
//     });
    
//     const serviceProduct = await stripe.products.create({
//       name: 'Service Fee',
//       description: 'Platform service fee'
//     });
    
//     const deliveryPrice = await stripe.prices.create({
//       product: deliveryProduct.id,
//       unit_amount: 6000,
//       currency: 'usd',
//     });
    
//     const servicePrice = await stripe.prices.create({
//       product: serviceProduct.id,
//       unit_amount: 1200,
//       currency: 'usd',
//     });
    
//     const subscriptionPrice = await stripe.prices.create({
//       unit_amount: Math.round(request.listing.pricing.rentPrice * 100),
//       currency: 'usd',
//       recurring: { interval: 'month' },
//       product_data: {
//         name: `Rental: ${request.listing.title}`,
//         metadata: {
//           listingId: request.listing._id.toString(),
//           requestId: id
//         }
//       }
//     });
    
//     // Calculate split
//     const PLATFORM_FEE_PERCENT = 15;
//     const totalAmountCents = Math.round(totalPrice * 100);
//     const platformFeeCents = Math.round(totalAmountCents * (PLATFORM_FEE_PERCENT / 100));
//     const vendorPayoutCents = totalAmountCents - platformFeeCents;
    
//     console.log('💰 Payment split:', {
//       total: totalPrice,
//       platformFee: platformFeeCents / 100,
//       vendorPayout: vendorPayoutCents / 100
//     });
    
//     // 🔑 KEY CHANGE: Create subscription WITHOUT transfer_data
//     // Money stays in your platform account until you manually transfer it
//     const subscription = await stripe.subscriptions.create({
//       customer: customerId,
//       items: [{ price: subscriptionPrice.id }],
//       default_payment_method: paymentMethodId,
//       add_invoice_items: [
//         { price: deliveryPrice.id },
//         { price: servicePrice.id }
//       ],
//       // ❌ REMOVE: application_fee_percent and transfer_data
//       // Money will be held in your platform account
//       payment_behavior: 'default_incomplete',
//       payment_settings: {
//         payment_method_types: ['card'],
//         save_default_payment_method: 'on_subscription'
//       },
//       expand: ['latest_invoice.payment_intent'],
//       metadata: {
//         requestId: id,
//         userId: request.user._id.toString(),
//         listingId: request.listing._id.toString(),
//         vendorId: vendor._id.toString(),
//         vendorStripeAccountId: vendor.stripe_account_id, // Store for later transfer
//         totalAmount: totalPrice.toString(),
//         platformFee: (platformFeeCents / 100).toString(),
//         vendorPayout: (vendorPayoutCents / 100).toString(),
//         transferStatus: 'pending' // Track transfer status
//       }
//     });
    
//     let paymentIntent = subscription.latest_invoice.payment_intent;
    
//     console.log('📋 Initial Payment Intent Status:', paymentIntent.status);
    
//     // Confirm payment intent
//     if (paymentIntent.status === 'requires_confirmation') {
//       paymentIntent = await stripe.paymentIntents.confirm(paymentIntent.id, {
//         payment_method: paymentMethodId
//       });
//     }
    
//     if (paymentIntent.status === 'requires_action') {
//       return res.status(200).json({
//         requiresAction: true,
//         clientSecret: paymentIntent.client_secret,
//         paymentIntentId: paymentIntent.id,
//         subscriptionId: subscription.id,
//         message: 'Payment requires additional authentication'
//       });
//     }
    
//     if (paymentIntent.status !== 'succeeded') {
//       return res.status(400).json({
//         error: 'Payment not completed',
//         status: paymentIntent.status
//       });
//     }
    
//     console.log('✅ Payment successful - money held in platform account');
    
//     // Update request with pending transfer status
//     await requestModel.findByIdAndUpdate(id, {
//       $set: {
//         approvedByUser: true,
//         paymentStatus: 'paid',
//         paymentIntentId: paymentIntent.id,
//         subscriptionId: subscription.id,
//         status: 'pending_confirmation', // User needs to confirm
//         totalAmount: totalPrice,
//         platformFee: platformFeeCents / 100,
//         vendorPayout: vendorPayoutCents / 100,
//         transferStatus: 'pending', // Track that money hasn't been transferred yet
//         transferAmount: vendorPayoutCents // Store amount to transfer later
//       }
//     });
    
//     const order = await orderModel.create({
//       user: request.user._id,
//       vendor: vendor._id,
//       listing: request.listing._id,
//       request: id,
//       deliveryType: request.deliveryType,
//       installationType: request.installationType,
//       deliveryAddress: request.deliveryAddress,
//       deliveryDate: request.deliveryDate || new Date(),
//       deliveryTime: request.deliveryTime || 'TBD',
//       monthlyRent: request.listing.pricing.rentPrice,
//       deliveryFee: 60,
//       serviceFee: 12,
//       totalAmount: totalPrice,
//       platformFee: platformFeeCents / 100,
//       vendorPayout: vendorPayoutCents / 100,
//       paymentIntentId: paymentIntent.id,
//       paymentStatus: 'paid',
//       paymentMethod: paymentMethodId,
//       status: 'processing', // Waiting for user confirmation
//       subscriptionId: subscription.id,
//       productImages: request.images && request.images[0] ? request.images[0] : {},
//       rentalStartDate: new Date(),
//       transferStatus: 'pending', // Money not transferred yet
//       transferAmount: vendorPayoutCents
//     });
    
//     await listing.findByIdAndUpdate(request.listing._id,{
//       $set:{
//         status:'sold'
//       }
//     })
//     return res.status(200).json({
//       success: true,
//       message: "Payment received. Funds will be released to vendor after confirmation.",
//       paymentIntentId: paymentIntent.id,
//       subscriptionId: subscription.id,
//       orderId: order._id,
//       status: paymentIntent.status,
//       transferStatus: 'pending',
//       paymentSplit: {
//         total: totalPrice,
//         platformFee: platformFeeCents / 100,
//         vendorPayout: vendorPayoutCents / 100,
//         note: 'Vendor payout held until confirmation'
//       }
//     });
    
//   } catch(e) {
//     console.log('Payment error:', e.message);
//     return res.status(400).json({
//       error: "Error occurred while processing payment: " + e.message
//     });
//   }
// };




module.exports.releasePaymentToVendor = async(req, res) => {
  const { orderId } = req.body;
  
  try {
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
    
    // Get the order/request with vendor info
    let order = await orderModel.findById(orderId)
      .populate('vendor')
      .populate('request');

      
    
      const requestId=order.request._id.toString()
    
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



module.exports.rejectDeliveryAndInstallation = async(req, res) => {
  const { orderId, reason } = req.body;
  const userId = req?.user?._id ? req.user._id : req.user.id;
  
  try {
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
    
    // Find the order and request
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
    
    // Verify the user owns this order
    if (order.user._id.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'Unauthorized: You do not own this order' 
      });
    }
    
    // Check if order is in correct status
    if (order.status !== 'processing' && order.status !== 'pending_confirmation') {
      return res.status(400).json({ 
        success: false,
        error: `Order cannot be rejected at this stage. Current status: ${order.status}`,
        currentStatus: order.status
      });
    }
    
    // Check if funds have already been transferred
    if (order.transferStatus === 'completed') {
      return res.status(400).json({ 
        success: false,
        error: 'Funds have already been transferred to vendor. Please contact support.',
        transferStatus: 'completed'
      });
    }
    
    // Check if order was already rejected
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
    
    // 1. Cancel the subscription to prevent future charges
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
        // Continue even if subscription is already cancelled
        if (!subError.message.includes('No such subscription')) {
          // If it's a real error (not "already cancelled"), log it
          console.error('Subscription cancel error details:', subError);
        }
      }
    }
    
    // 2. Calculate credit amount for user
    // Platform keeps service fee only, user gets back monthly rent + delivery fee as credit
    const monthlyRent = parseFloat(order.monthlyRent || 0);
    const deliveryFee = parseFloat(order.deliveryFee || 0);
    const serviceFee = parseFloat(order.serviceFee || 0);
    
    // User gets back: monthly rent + delivery fee
    const creditAmount = monthlyRent + deliveryFee;
    // Platform keeps: service fee only
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
    
    // 3. Add credit to user's account (NO CARD REFUND)
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
    
    // 4. Create vendor strike record
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
      // Continue processing even if strike creation fails
    }
    
    // 5. Update order status
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
    
    // 6. Update request status
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
    
    // 7. Update listing status back to available
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
    
    // 8. Log the transaction for audit trail
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
    
    // 9. Optional: Send notification email to user and vendor
    // await sendRejectionNotificationEmail(updatedUser, order, creditAmount, reason);
    // await sendVendorRejectionNotification(order.vendor, order, reason);
    
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