const orderModel = require('../models/order');
const userModel = require('../models/user');
const Vendor=require('../models/vendor')
const jwt = require('jsonwebtoken');

module.exports.storeBilling = async (req, res) => {
    const { cardState, draftDay } = req.body;
    
    try {
      
        const paymentMethodToken = jwt.sign(
            { paymentMethodId: cardState, draftDay }, 
            process.env.PAYMENT_METHOD_JWT_KEY
        );

       
        await userModel.findByIdAndUpdate(
            req.user._id, 
            { $set: { paymentMethodToken } },
            { lean: true }
        );

        return res.status(200).json({
            message: "Billing details saved successfully"
        });
    } catch (e) {
        console.error("Error storing billing:", e.message);
        return res.status(500).json({
            error: "Facing issue while storing billing info please try again"
        });
    }
};



module.exports.updatePaymentMethod=async(req,res)=>{
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
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
        const stripe = require('stripe')(process.env.STRIPE_LIVE);
       
        let orders = await orderModel.find({
            
            status: { $in: ['active', 'pending'] }
        });
        orders=orders?.filter(u=>u?.user?.toString()==req?.user?._id?.toString())


        if (orders.length === 0) {
            return res.status(400).json({
                error: "No active subscriptions found to pause"
            });
        }

       
        const pausePromises = orders.map(async (order) => {
            try {
              
                if (!order.subscriptionId) {
                    console.log(`Order ${order._id} has no subscription ID`);
                    return { orderId: order._id, success: false, error: 'No subscription ID' };
                }

                const subscription = await stripe.subscriptions.update(
                    order.subscriptionId,
                    {
                        pause_collection: {
                            behavior: 'void', 
                        },
                    }
                );

            
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

       
        const results = await Promise.all(pausePromises);

       
        const successful = results.filter(result => result.success);
        const failed = results.filter(result => !result.success);

        await userModel.findByIdAndUpdate(req.user._id,{
            $set:{
                billingPaused:true
            }
        })
 
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
        const stripe = require('stripe')(process.env.STRIPE_LIVE);
     
        let orders = await orderModel.find({
            status: 'paused'
        });
     
        orders=orders?.filter(u=>u?.user?.toString()==req?.user?._id?.toString())

        if (orders.length === 0) {
            return res.status(400).json({
                error: "No paused subscriptions found to resume"
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
                        pause_collection: '',
                    }
                );

                
                await orderModel.findByIdAndUpdate(order._id, {
                    status: 'active',
                    resumedAt: new Date(),
                    $unset: { pausedAt: 1 } 
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





module.exports.handleStripeConnectWebhook = async (req, res) => {
  const stripe = require('stripe')(process.env.STRIPE_LIVE);
  // const endpointSecret = "whsec_1QTQ8XtkP0rFEVQbyWj282ebsc1WArsZ";
  const endpointSecret = "whsec_b82d718fbae44ab38035f9ce59915a1c5c7870d001c5d90f38cab27b8e52a15c";
  const sig = req.headers['stripe-signature'];

  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  console.log('✅ Webhook received:', event.type);
  
  try {
    switch (event.type) {
      case 'account.updated':
  
        await handleAccountUpdated(event.data.object, stripe);
        break;
      
      case 'account.external_account.created':
        await handleExternalAccountCreated(event.data.object);
        break;
      
      case 'capability.updated':
        await handleCapabilityUpdated(event.data.object, stripe);
        break;
      
      case 'account.application.authorized':
        await handleAccountAuthorized(event.data.object, stripe);
        break;
      
      case 'account.application.deauthorized':
        await handleAccountDeauthorized(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};


async function handleAccountUpdated(accountFromWebhook, stripe) {
  console.log('📝 Processing account.updated for:', accountFromWebhook.id);
  
  try {

    const vendor = await Vendor.findOne({ stripe_account_id: accountFromWebhook.id });
    
    if (!vendor) {
      console.log('⚠️ No vendor found for account:', accountFromWebhook.id);
      return;
    }
    
  
    console.log('🔄 Fetching fresh account data from Stripe API...');
    const account = await stripe.accounts.retrieve(accountFromWebhook.id);
    
  
    const isFullyOnboarded =
    account.details_submitted === true &&
    account.payouts_enabled === true &&
    (account.requirements?.currently_due?.length === 0);
  
    console.log('============ FRESH ACCOUNT STATUS ============');
    console.log('Vendor ID:', vendor._id);
    console.log('Account ID:', account.id);
    console.log('charges_enabled:', account.charges_enabled);
    console.log('payouts_enabled:', account.payouts_enabled);
    console.log('details_submitted:', account.details_submitted);
    console.log('transfers_capability:', account.capabilities?.transfers);
    console.log('isFullyOnboarded:', isFullyOnboarded);
    console.log('Currently due:', account.requirements?.currently_due);
    console.log('Eventually due:', account.requirements?.eventually_due);
    console.log('=============================================');
    

    const updatedVendor = await Vendor.findByIdAndUpdate(
      vendor._id,
      {
        $set: {
          stripe_connect_status: isFullyOnboarded,
          stripe_account_id: account.id,
          stripeAccountData: {
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted,
            transfersCapability: account.capabilities?.transfers,
            country: account.country,
            defaultCurrency: account.default_currency,
            currentlyDue: account.requirements?.currently_due || [],
            eventuallyDue: account.requirements?.eventually_due || [],
            lastUpdated: new Date()
          }
        }
      },
      { new: true, runValidators: false }
    );
    
    if (isFullyOnboarded) {
      console.log('✅✅✅ VENDOR ONBOARDING COMPLETE ✅✅✅');
      console.log('Vendor:', updatedVendor._id);
      console.log('Status in DB:', updatedVendor.stripe_connect_status);
      
      
    } else {
      console.log('⏳ VENDOR ONBOARDING INCOMPLETE');
      console.log('Vendor:', vendor._id);
      console.log('Missing requirements:', account.requirements?.currently_due);
    }
    
  } catch (error) {
    console.error('❌ Error handling account.updated:', error);
    throw error;
  }
}

async function handleExternalAccountCreated(externalAccount) {
  console.log('🏦 External account created:', externalAccount.id);
  
  try {
    const vendor = await Vendor.findOne({ 
      stripe_account_id: externalAccount.account 
    });
    
    if (vendor) {
      console.log('✅ Bank account added for vendor:', vendor._id);
      
      await Vendor.findByIdAndUpdate(vendor._id, {
        $set: {
          'stripeAccountData.hasBankAccount': true,
          'stripeAccountData.bankAccountLast4': externalAccount.last4,
          'stripeAccountData.bankAccountStatus': externalAccount.status
        }
      });
    }
  } catch (error) {
    console.error('Error handling external_account.created:', error);
  }
}

async function handleCapabilityUpdated(capability, stripe) {
  console.log('⚡ Capability updated:', capability.id, 'Status:', capability.status);
  
  try {
    const vendor = await Vendor.findOne({ 
      stripe_account_id: capability.account 
    });
    
    if (vendor) {
      await Vendor.findByIdAndUpdate(vendor._id, {
        $set: {
          [`stripeAccountData.${capability.id}Capability`]: capability.status
        }
      });
      
      if (capability.id === 'transfers' && capability.status === 'active') {
        console.log('✅ TRANSFERS CAPABILITY ACTIVE for vendor:', vendor._id);
        
        
        console.log('🔄 Fetching full account data after transfers activated...');
        const account = await stripe.accounts.retrieve(capability.account);
        
        const isFullyOnboarded = account.charges_enabled && 
                                 account.payouts_enabled &&
                                 account.details_submitted &&
                                 account.capabilities?.transfers === 'active';
        
        await Vendor.findByIdAndUpdate(vendor._id, {
          $set: {
            stripe_connect_status: isFullyOnboarded,
            stripeAccountData: {
              chargesEnabled: account.charges_enabled,
              payoutsEnabled: account.payouts_enabled,
              detailsSubmitted: account.details_submitted,
              transfersCapability: account.capabilities?.transfers,
              country: account.country,
              defaultCurrency: account.default_currency,
              currentlyDue: account.requirements?.currently_due || [],
              eventuallyDue: account.requirements?.eventually_due || [],
              lastUpdated: new Date()
            }
          }
        });
        
        console.log('✅ Full account status updated. Onboarded:', isFullyOnboarded);
      }
    }
  } catch (error) {
    console.error('Error handling capability.updated:', error);
  }
}

async function handleAccountAuthorized(application, stripe) {
  console.log('✅ Account authorized:', application.account);
  
  try {
    const vendor = await Vendor.findOne({ 
      stripe_account_id: application.account 
    });
    
    if (vendor) {
      await Vendor.findByIdAndUpdate(vendor._id, {
        $set: {
          'stripeAccountData.applicationStatus': 'authorized'
        }
      });
      console.log('✅ Application authorized for vendor:', vendor._id);
      

      console.log('🔄 Fetching full account data after authorization...');
      const account = await stripe.accounts.retrieve(application.account);
      
      const isFullyOnboarded = account.charges_enabled && 
                               account.payouts_enabled &&
                               account.details_submitted &&
                               account.capabilities?.transfers === 'active';
      
      await Vendor.findByIdAndUpdate(vendor._id, {
        $set: {
          stripe_connect_status: isFullyOnboarded,
          stripeAccountData: {
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted,
            transfersCapability: account.capabilities?.transfers,
            country: account.country,
            defaultCurrency: account.default_currency,
            currentlyDue: account.requirements?.currently_due || [],
            eventuallyDue: account.requirements?.eventually_due || [],
            lastUpdated: new Date()
          }
        }
      });
      
      console.log('✅ Full account status updated. Onboarded:', isFullyOnboarded);
    }
  } catch (error) {
    console.error('Error handling account.application.authorized:', error);
  }
}

async function handleAccountDeauthorized(application) {
  console.log('⚠️ Account deauthorized:', application.account);
  
  try {
    const vendor = await Vendor.findOne({ 
      stripe_account_id: application.account 
    });
    
    if (vendor) {
      await Vendor.findByIdAndUpdate(vendor._id, {
        $set: {
          stripe_connect_status: false,
          'stripeAccountData.applicationStatus': 'deauthorized'
        }
      });
      console.log('⚠️ Application deauthorized for vendor:', vendor._id);
    }
  } catch (error) {
    console.error('Error handling account.application.deauthorized:', error);
  }
}
  
  async function handleExternalAccountCreated(externalAccount) {
    console.log('🏦 External account created:', externalAccount.id);
    
    try {
      const vendor = await Vendor.findOne({ 
        stripe_account_id: externalAccount.account 
      });
      
      if (vendor) {
        console.log('✅ Bank account added for vendor:', vendor._id);
        

        await Vendor.findByIdAndUpdate(vendor._id, {
          $set: {
            'stripeAccountData.hasBankAccount': true,
            'stripeAccountData.bankAccountLast4': externalAccount.last4,
            'stripeAccountData.bankAccountStatus': externalAccount.status
          }
        });
      }
    } catch (error) {
      console.error('Error handling external_account.created:', error);
    }
  }
  
  /**
   * Handle capability.updated event
   * Transfers capability is what allows receiving payments
   */
  async function handleCapabilityUpdated(capability) {
    console.log('⚡ Capability updated:', capability.id, capability.status);
    
    try {
      const vendor = await Vendor.findOne({ 
        stripe_account_id: capability.account 
      });
      
      if (vendor && capability.id === 'transfers') {
        const isActive = capability.status === 'active';
        
        await Vendor.findByIdAndUpdate(vendor._id, {
          $set: {
            'stripeAccountData.transfersCapability': capability.status
          }
        });
        
        if (isActive) {
          console.log('✅ Transfers capability ACTIVE for vendor:', vendor._id);
        } else {
          console.log('⏳ Transfers capability status:', capability.status);
        }
      }
    } catch (error) {
      console.error('Error handling capability.updated:', error);
    }
  }
  
  /**
   * Handle account.application.authorized event
   * Account successfully connected
   */
  async function handleAccountAuthorized(application) {
    console.log('✅ Account authorized:', application.account);
    
    try {
      const vendor = await Vendor.findOne({ 
        stripe_account_id: application.account 
      });
      
      if (vendor) {
        await Vendor.findByIdAndUpdate(vendor._id, {
          $set: {
            'stripeAccountData.applicationStatus': 'authorized'
          }
        });
        console.log('✅ Application authorized for vendor:', vendor._id);
      }
    } catch (error) {
      console.error('Error handling account.application.authorized:', error);
    }
  }
  
  /**
   * Handle account.application.deauthorized event
   * Account disconnected
   */
  async function handleAccountDeauthorized(application) {
    console.log('⚠️ Account deauthorized:', application.account);
    
    try {
      const vendor = await Vendor.findOne({ 
        stripe_account_id: application.account 
      });
      
      if (vendor) {
        await Vendor.findByIdAndUpdate(vendor._id, {
          $set: {
            stripe_connect_status: false,
            'stripeAccountData.applicationStatus': 'deauthorized'
          }
        });
        console.log('⚠️ Application deauthorized for vendor:', vendor._id);
      }
    } catch (error) {
      console.error('Error handling account.application.deauthorized:', error);
    }
  }

  