const orderModel = require("../models/order");
const requestModel = require("../models/request");
const userModel=require('../models/user')
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


module.exports.approveOfferByUser = async(req, res) => {
    let { id, totalPrice, paymentMethodId } = req.body;
    try {
      const stripe = require('stripe')(process.env.STRIPE_LIVE);
      let request = await requestModel.findById(id).populate('user').populate('listing');
      
      // Step 1: Create or retrieve Stripe customer
      let customerId = request.user.stripeCustomerId;
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: request.user.email,
          name: request.user.name || request.user.username,
          metadata: {
            userId: request.user._id.toString()
          }
        });
        customerId = customer.id;
        
        // Save customer ID to user
        await userModel.findByIdAndUpdate(request.user._id, {
          $set: { stripeCustomerId: customerId }
        });
      }
      
      // Step 2: Attach payment method to customer (if not already attached)
      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        
        if (paymentMethod.customer !== customerId) {
          await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId
          });
          
          // Set as default payment method
          await stripe.customers.update(customerId, {
            invoice_settings: {
              default_payment_method: paymentMethodId
            }
          });
        }
      } catch (attachError) {
        console.log('Payment method already attached or error:', attachError.message);
      }
      
      // Step 3: Create products and prices for one-time fees
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
        unit_amount: 6000, // $60 in cents
        currency: 'usd',
      });
      
      const servicePrice = await stripe.prices.create({
        product: serviceProduct.id,
        unit_amount: 1200, // $12 in cents
        currency: 'usd',
      });
      
      // Step 4: Create subscription price
      const subscriptionPrice = await stripe.prices.create({
        unit_amount: Math.round(request.listing.pricing.rentPrice * 100),
        currency: 'usd',
        recurring: {
          interval: 'month'
        },
        product_data: {
          name: `Rental: ${request.listing.title}`,
          metadata: {
            listingId: request.listing._id.toString(),
            requestId: id
          }
        }
      });
      
      // Step 5: Create subscription with automatic payment
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price: subscriptionPrice.id
        }],
        default_payment_method: paymentMethodId,
        add_invoice_items: [
          {
            price: deliveryPrice.id
          },
          {
            price: servicePrice.id
          }
        ],      
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
          totalAmount: totalPrice.toString()
        }
      });
      
      const paymentIntent = subscription.latest_invoice.payment_intent;
      
      console.log('Payment Intent Status:', paymentIntent.status);
      console.log('Subscription Status:', subscription.status);
      
      // Helper function to update request and create order
      const completeOrder = async () => {
        await requestModel.findByIdAndUpdate(id, {
          $set: {
            approvedByUser: true,
            paymentStatus: 'paid',
            paymentIntentId: paymentIntent.id,
            subscriptionId: subscription.id,
            status: 'confirmed',
            totalAmount: totalPrice
          }
        });
        
        const order = await orderModel.create({
          user: request.user._id,
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
          paymentIntentId: paymentIntent.id,
          paymentStatus: 'paid',
          paymentMethod: paymentMethodId,
          status: 'confirmed',
          subscriptionId: subscription.id,
          productImages: request.images && request.images[0] ? request.images[0] : {},
          rentalStartDate: new Date()
        });
        
        return order;
      };
      
      // Step 6: Handle different payment intent statuses
    
          const order = await completeOrder();
          
          return res.status(200).json({
            message: "Payment successful and subscription created",
            paymentIntentId: paymentIntent.id,
            subscriptionId: subscription.id,
            orderId: order._id,
            status: paymentIntent.status
          });
          
       
      
    } catch(e) {
      console.log('Payment error:', e.message);
      console.log('Full error:', e);
      return res.status(400).json({
        error: "Error occurred while processing payment: " + e.message
      });
    }
  }