const orderModel = require('../models/order');
const userModel = require('../models/user');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')('sk_test_51OwuO4LcfLzcwwOYsXYljgE1gUyGnLFvjewSf1NG9CsrSqTsxm7n7ppmZ2ZIFL01ptVDhuW7LixPggik41wWmOyE00RjWnYxUA');

module.exports.storeBilling = async (req, res) => {
    const { ...data } = req.body;
   
    
 
    try {
        // Generate payment method token
        let paymentMethodToken = jwt.sign({paymentMethodId:data.paymentMethodId,draftDay:data.draftDay}, process.env.PAYMENT_METHOD_JWT_KEY, {
            
        });

        // Update user with payment method token
        await userModel.findByIdAndUpdate(req.user._id, {
            $set: {
                paymentMethodToken: paymentMethodToken
            }
        });

        return res.status(200).json({
            message: "Billing details saved successfully"
        });
    } catch (e) {
        console.log(e.message);
        return res.status(500).json({
            error: "Facing issue while storing billing info please try again",
            details: e.message
        });
    }
};


module.exports.updatePaymentMethod=async(req,res)=>{
    let user=await userModel.findOne({_id:req.user._id})
    const {paymentMethodId}=req.body;
    
    try{
        let paymentMethodData= jwt.verify(user?.paymentMethodToken, process.env.PAYMENT_METHOD_JWT_KEY, {
            
        });

     
        let paymentMethodToken = jwt.sign({paymentMethodId:paymentMethodId,draftDay:paymentMethodData.draftDay}, process.env.PAYMENT_METHOD_JWT_KEY, {
            
        });

await userModel.findByIdAndUpdate(req.user._id,{
    $set:{
        paymentMethodToken
    }
})

await stripe.paymentMethods.attach(paymentMethodId, {
    customer: user.customerId,
});
       
return res.status(200).json({
    message:"Billing info updated sucessfully"
})
    }catch(e){
        console.log(e.message);
        return res.status(500).json({
            error: "Facing issue while upading billing info please try again",
            details: e.message
        });
    }
}

module.exports.pauseBilling = async (req, res) => {
    try {
        // Find all active orders for the user
        let orders = await orderModel.find({
            
            status: { $in: ['active', 'pending'] } // Only pause active subscriptions
        });
        orders=orders?.filter(u=>u?.user?.toString()==req?.user?._id?.toString())

        if (orders.length === 0) {
            return res.status(404).json({
                message: "No active subscriptions found to pause"
            });
        }

        // Use Promise.all to handle multiple async operations properly
        const pausePromises = orders.map(async (order) => {
            try {
                // Check if subscription exists and is active
                if (!order.subscriptionId) {
                    console.log(`Order ${order._id} has no subscription ID`);
                    return { orderId: order._id, success: false, error: 'No subscription ID' };
                }

                const subscription = await stripe.subscriptions.update(
                    order.subscriptionId,
                    {
                        pause_collection: {
                            behavior: 'void', // Options: 'keep_as_draft', 'mark_uncollectible', 'void'
                        },
                    }
                );

                // Update the order status in your database
                await orderModel.findByIdAndUpdate(order._id, {
                    status: 'paused',
                    pausedAt: new Date()
                });

                return { 
                    orderId: order._id, 
                    subscriptionId: order.subscriptionId,
                    success: true, 
                    subscription: subscription 
                };

            } catch (error) {
                console.log(`Error pausing subscription ${order.subscriptionId}:`, error.message);
                return { 
                    orderId: order._id, 
                    subscriptionId: order.subscriptionId,
                    success: false, 
                    error: error.message 
                };
            }
        });

        // Wait for all pause operations to complete
        const results = await Promise.all(pausePromises);

        // Separate successful and failed operations
        const successful = results.filter(result => result.success);
        const failed = results.filter(result => !result.success);

        await userModel.findByIdAndUpdate(req.user._id,{
            $set:{
                billingPaused:true
            }
        })
        // Return comprehensive response
        return res.status(200).json({
            message: "Billing pause operation completed",
            totalOrders: orders.length,
            successful: successful.length,
            failed: failed.length,
            results: {
                successful: successful,
                failed: failed
            }
        });

    } catch (e) {
        console.log("Pause billing error:", e.message);
        return res.status(500).json({
            error: "Facing issue while pausing billing please try again",
            details: e.message
        });
    }
}





module.exports.resumeBilling = async (req, res) => {
    try {
        // Find all paused orders for the user
        let orders = await orderModel.find({
            user: req.user._id,
            status: 'paused'
        });
        orders=orders?.filter(u=>u?.user?.toString()==req?.user?._id?.toString())

        if (orders.length === 0) {
            return res.status(404).json({
                message: "No paused subscriptions found to resume"
            });
        }

        const resumePromises = orders.map(async (order) => {
            try {
                if (!order.subscriptionId) {
                    return { orderId: order._id, success: false, error: 'No subscription ID' };
                }

                const subscription = await stripe.subscriptions.update(
                    order.subscriptionId,
                    {
                        pause_collection: '', // Remove pause collection
                    }
                );

                // Update the order status back to active
                await orderModel.findByIdAndUpdate(order._id, {
                    status: 'active',
                    resumedAt: new Date(),
                    $unset: { pausedAt: 1 } // Remove pausedAt field
                });

                await userModel.findByIdAndUpdate(req.user._id,{
                    $set:{
                        billingPaused:false
                    }
                })
                return { 
                    orderId: order._id, 
                    subscriptionId: order.subscriptionId,
                    success: true, 
                    subscription: subscription 
                };

            } catch (error) {
                console.log(`Error resuming subscription ${order.subscriptionId}:`, error.message);
                return { 
                    orderId: order._id, 
                    subscriptionId: order.subscriptionId,
                    success: false, 
                    error: error.message 
                };
            }
        });

        const results = await Promise.all(resumePromises);
        const successful = results.filter(result => result.success);
        const failed = results.filter(result => !result.success);

        return res.status(200).json({
            message: "Billing resume operation completed",
            totalOrders: orders.length,
            successful: successful.length,
            failed: failed.length,
            results: {
                successful: successful,
                failed: failed
            }
        });

    } catch (e) {
        console.log("Resume billing error:", e.message);
        return res.status(500).json({
            error: "Facing issue while resuming billing please try again",
            details: e.message
        });
    }
}