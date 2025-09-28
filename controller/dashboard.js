const ordersModel = require('../models/order')
const userModel = require('../models/user')
const jwt = require('jsonwebtoken')


const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; 


const getCachedData = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};


const setCachedData = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

module.exports.getDashboardData = async (req, res) => {
  try {
    console.log("HEY")
    const stripe = require('stripe')(process.env.STRIPE_LIVE);

    let user=await userModel.findById(req.user._id)
    let orders=await ordersModel.find({})
    orders=orders?.filter(u=>u?.user?.toString()==req?.user?._id?.toString())
 
    let paymentMethodId = jwt.verify(user.paymentMethodToken, process.env.PAYMENT_METHOD_JWT_KEY);
    paymentMethodId=paymentMethodId.paymentMethodId

    paymentMethod = await stripe.customers.retrievePaymentMethod(
      user.customerId,
      paymentMethodId
    );
 
   
return res.status(200).json({
  orders,
  user,
  paymentMethod
})

  } catch (error) {
    console.error('Dashboard data fetch error:', error.message);
    
 
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: "Invalid user ID format"
      });
    }
    
    if (error.type === 'StripeError') {
      return res.status(503).json({
        error: "Payment service temporarily unavailable"
      });
    }

    return res.status(500).json({
      error: "Unable to fetch data at this time"
    });
  }
}


setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, CACHE_TTL);