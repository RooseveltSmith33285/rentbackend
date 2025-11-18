const cron = require('node-cron');
const orderModel = require('../models/order'); // Adjust path as needed

// Run every day at midnight (00:00)
// Cron format: minute hour day month weekday
// '0 0 * * *' = every day at midnight
const autoConfirmOrdersCronJob = cron.schedule('0 0 * * *', async () => {
  console.log('🕐 Running auto-confirm orders cron job...');
  
  try {
    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    console.log('📅 Checking orders created before:', sevenDaysAgo.toISOString());
    
    // Find all orders with status 'processing' that were created more than 7 days ago
    const ordersToConfirm = await orderModel.find({
      status: 'processing',
      createdAt: { $lte: sevenDaysAgo }
    });
    
    console.log(`📦 Found ${ordersToConfirm.length} orders to auto-confirm`);
    
    if (ordersToConfirm.length === 0) {
      console.log('✅ No orders need confirmation');
      return;
    }
    
    // Update all found orders to 'confirmed' status
    const result = await orderModel.updateMany(
      {
        status: 'processing',
        createdAt: { $lte: sevenDaysAgo }
      },
      {
        $set: {
          status: 'confirmed',
          autoConfirmedAt: new Date(),
          autoConfirmedReason: 'Auto-confirmed after 7 days without renter approval'
        }
      }
    );
    
    console.log(`✅ Auto-confirmed ${result.modifiedCount} orders`);
    
    // Log each order that was confirmed
    ordersToConfirm.forEach(order => {
      console.log(`   📋 Order ${order.orderNumber || order._id} - Created: ${order.createdAt}`);
    });
    
  } catch (error) {
    console.error('❌ Error in auto-confirm cron job:', error);
  }
});

// Start the cron job
autoConfirmOrdersCronJob.start();
console.log('✅ Auto-confirm orders cron job scheduled (runs daily at midnight)');

module.exports = autoConfirmOrdersCronJob;