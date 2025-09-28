const cartModel = require('../models/cart');
const orderModel = require('../models/order');
const userModel = require('../models/user');


const jwt=require('jsonwebtoken')
module.exports.createOrder = async (req, res) => {
    const { ...data } = req.body;
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
    
    try {
    let user=await userModel.findOne({_id:req.user._id})
    let paymentMethodId=jwt.verify(user.paymentMethodToken,process.env.PAYMENT_METHOD_JWT_KEY)
    let draftDay=paymentMethodId.draftDay
paymentMethodId=paymentMethodId.paymentMethodId
  
        const [cart] = await Promise.all([
            cartModel.findOne({ user: req.user._id }).populate('items').lean(), 
            
        ]);

     let subscriptionId=await createSubscription(cart.items,paymentMethodId,user,draftDay)

        
        if (!cart) {
            return res.status(404).json({
                error: "Cart not found"
            });
        }

      
        if (!cart.items || cart.items.length === 0) {
            return res.status(400).json({
                error: "Cannot create order with empty cart"
            });
        }

        const orderData = {
            ...data,
            user: req.user._id,
            items:cart.items,
            comboItem:cart.comboItem,
            subscriptionId,
            status: 'active',
            createdAt: new Date(),
        };

     
        const result = await orderModel.collection.insertOne(orderData);

        
        await cartModel.updateOne(
            { _id: cart._id }, 
            { $set: { items: [],comboItem:[], updatedAt: new Date() } }
        );

        return res.status(201).json({
            message: "Order created successfully",
            orderId: result.insertedId
        });

    } catch (e) {

        console.error('Order creation error:', e.message);
        
      
        if (e.name === 'ValidationError') {
            return res.status(400).json({
                error: "Invalid order data",
                details: e.message
            });
        }
        
        return res.status(500).json({
            error: "Unable to create order at this time",
            details: process.env.NODE_ENV === 'development' ? e.message : undefined
        });
    }
};


const createSubscription = async (items, paymentMethod, customer,draftDay) => {
    try {
        const stripe = require('stripe')(process.env.STRIPE_LIVE);
        console.log("STRIPE KEY BEING USED IS")
        console.log(process.env.STRIPE_LIVE)
        if(!customer.customerId){
           
            const customertwo = await stripe.customers.create({
                name: customer.name,
                email: customer.email,
            });
            await userModel.updateOne({email:customer.email},{
                $set:{
                    customerId:customertwo.id
                }
            })
    
           
            await stripe.paymentMethods.attach(paymentMethod, {
                customer: customertwo.id,
            });
            await stripe.customers.update(customertwo.id, {
                invoice_settings: {
                    default_payment_method: paymentMethod,
                },
            });
            customer={
                ...customer,
                customerId:customertwo.id
            }
        }else{
            await stripe.paymentMethods.attach(paymentMethod, {
                customer: customer.customerId,
            });
        }

       
        const pricePromises = items.map(async (item) => {
            const price = await stripe.prices.create({
                currency: 'usd',
                unit_amount: item.monthly_price * 100, 
                recurring: {
                    interval: 'month',
                },
                product_data: {
                    name: item.name,
                    metadata: {
                        product_id: item._id.toString() 
                    }
                },
            });
            return price.id;
        });

 
        const priceIds = await Promise.all(pricePromises);

      
        const subscriptionItems = priceIds.map(priceId => ({
            price: priceId,
        }));

       
        const subscription = await stripe.subscriptions.create({
            customer: customer.customerId,
            items: subscriptionItems,
            default_payment_method: paymentMethod,
            billing_cycle_anchor_config: {
                day_of_month: draftDay, 
            },
        });

      if(items.length==1){
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 2500,
            currency: 'usd',
            customer:customer.customerId,
            payment_method:paymentMethod
          });
          const paymentIntentConfirm = await stripe.paymentIntents.confirm(
            paymentIntent.id,
            {
              payment_method: 'pm_card_visa',
              return_url: 'https://www.example.com',
            }
          );
      }

        return subscription.id;

    } catch (e) {
        console.log(e.message);
        throw e; 
    }
}

module.exports.getOrders = async (req, res) => {
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
    try {
        const { page = 1, limit = 10, sort = '-createdAt' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
       
        if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                error: "Invalid pagination parameters"
            });
        }

      
        const orders = await orderModel
            .find({ user: req.user._id })
            .select('-__v') 
            .sort(sort)
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum)
            .lean(); 

        
        const totalOrders = await orderModel.countDocuments({ user: req.user._id });

       
        res.set('Cache-Control', 'private, max-age=300'); 

        return res.status(200).json({
            orders,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalOrders / limitNum),
                totalOrders,
                hasNext: pageNum < Math.ceil(totalOrders / limitNum),
                hasPrev: pageNum > 1
            }
        });

    } catch (e) {
        console.error('Orders fetch error:', e.message);
        
        return res.status(500).json({
            error: "Unable to fetch orders at this time",
            details: process.env.NODE_ENV === 'development' ? e.message : undefined
        });
    }
};



const mongoose = require('mongoose');

module.exports.getRecentOrder = async (req, res) => {
    try {
        let order = await orderModel.findOne({
            $expr: { $eq: [{ $toString: "$user" }, req.user._id.toString()] }
        }).sort({ createdAt: -1 });
        
        console.log('Order found:', order);
        
        return res.status(200).json({
            success: true,
            data: order
        });

    } catch (e) {
        console.error('Orders fetch error:', e.message);
        return res.status(500).json({
            error: "Unable to fetch orders at this time",
            details: process.env.NODE_ENV === 'development' ? e.message : undefined
        });
    }
};

module.exports.getOrderById = async (req, res) => {
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
    try {
        const { orderId } = req.params;
        
        if (!orderId) {
            return res.status(400).json({
                error: "Order ID is required"
            });
        }

        const order = await orderModel
            .findOne({ _id: orderId, user: req.user._id })
            .select('-__v')
            .lean();

        if (!order) {
            return res.status(404).json({
                error: "Order not found"
            });
        }

        res.set('Cache-Control', 'private, max-age=600');

        return res.status(200).json({
            order
        });

    } catch (e) {
        console.error('Order fetch error:', e.message);
        
        if (e.name === 'CastError') {
            return res.status(400).json({
                error: "Invalid order ID format"
            });
        }
        
        return res.status(500).json({
            error: "Unable to fetch order details",
            details: process.env.NODE_ENV === 'development' ? e.message : undefined
        });
    }
};


module.exports.verifyCalandar=async(req,res)=>{
    try{
     
let orders=await orderModel.find({},{deliveryDate:1,deliveryTime:1})
return res.status(200).json({
    orders
})   
}catch(e){
        return res.status(500).json({
            error: "Unable to fetch order details",
            details: process.env.NODE_ENV === 'development' ? e.message : undefined
        });
    }
}