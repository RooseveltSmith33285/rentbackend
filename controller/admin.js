


let {cloudinaryUploadImage}=require('../middleware/cloudinary')
const fs=require('fs')

const userModel=require('../models/user');
const adminModel = require('../models/admin');
const vendor=require('../models/vendor')
const orderModel = require('../models/order');
const listingModel=require('../models/listing')
const Product = require('../models/products');
const SupportTicket  = require('../models/ticket');
const {SupportMessage}=require('../models/support')




module.exports.getUsers = async (req, res) => {
    try {
       
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        
       
        const skip = (page - 1) * limit;
       
        let searchQuery = { deletedUser: false };
        
       
        if (search) {
            searchQuery.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ];
        }
        
       
        if (status !== 'all') {
            if (status === 'active') {
                searchQuery.billingPaused = false;
            } else if (status === 'suspended') {
                searchQuery.billingPaused = true;
            }
        }
        
       
        const totalUsers = await userModel.countDocuments(searchQuery);
        
       
        const users = await userModel.find(searchQuery)
            .sort({ createdAt: -1 }) 
            .skip(skip)
            .limit(limit)
            .select('-password'); 
        
     
        const totalPages = Math.ceil(totalUsers / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
        return res.status(200).json({
            users,
            pagination: {
                currentPage: page,
                totalPages,
                totalUsers,
                limit,
                hasNext,
                hasPrev
            }
        });

    } catch (e) {
        console.log(e.message);
        return res.status(400).json({
            error: "Facing issue while fetching users"
        });
    }
}



module.exports.getVendors = async (req, res) => {
    try {
       
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        
       
        const skip = (page - 1) * limit;
       
  
let searchQuery = { 
    $or: [
        { deletedUser: { $exists: false } },
        { deletedUser: false }
    ]
};

        if (search) {
            searchQuery.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } }
            ];
        }
        
       
        if (status !== 'all') {
            if (status === 'active') {
                searchQuery.isActive = true;  
            } else if (status === 'suspended') {
                searchQuery.isActive = false;  
            }
        }
        
       
        const totalVendors = await vendor.countDocuments(searchQuery);
        
       
        const vendors = await vendor.find(searchQuery)
        .sort({ createdAt: -1 }) 
        .skip(skip)
        .limit(limit)
        .select('-password')
        .lean();
        const vendorIds = vendors.map(v => v._id);

        const revenueData = await orderModel.aggregate([
            {
                $match: {
                    vendor: { $in: vendorIds },
                    status: 'confirmed' 
                }
            },
            {
                $group: {
                    _id: '$vendor',
                    totalRevenue: { $sum: '$vendorPayout' }, 
                    totalOrders: { $sum: 1 }
                }
            }
        ]);
        
        
        const revenueMap = {};
        revenueData.forEach(item => {
            revenueMap[item._id.toString()] = {
                totalRevenue: item.totalRevenue || 0,
                totalOrders: item.totalOrders || 0
            };
        });
        
       
        vendors.forEach(v => {
            const vendorId = v._id.toString();
            const revenue = revenueMap[vendorId] || { totalRevenue: 0, totalOrders: 0 };
            
       
            if (!v.stats) {
                v.stats = {};
            }
            v.stats.totalRevenue = revenue.totalRevenue;
            v.stats.completedOrders = revenue.totalOrders;
        });
        
     
        const totalPages = Math.ceil(totalVendors / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
        return res.status(200).json({
            vendors,
            pagination: {
                currentPage: page,
                totalPages,
                totalVendors,
                limit,
                hasNext,
                hasPrev
            }
        });

    } catch (e) {
        console.log(e.message);
        return res.status(400).json({
            error: "Facing issue while fetching users"
        });
    }
}
module.exports.updateUser=async(req,res)=>{
    let {id}=req.params;
    let {...data}=req.body;
    try{
        let users=await userModel.findByIdAndUpdate(id,{
            $set:data
        })

return res.status(200).json({
    message:"User updated sucessfully"
})

    }catch(e){
console.log(e.message)
return res.status(400).json({
    error:"Facing issue while updating users"
})
    }
}




module.exports.updateVendor=async(req,res)=>{
    let {id}=req.params;
    let {...data}=req.body;
    try{
       await vendor.findByIdAndUpdate(id,{
        $set:data
       })
return res.status(200).json({
    message:"Vendor updated sucessfully"
})

    }catch(e){
console.log(e.message)
return res.status(400).json({
    error:"Facing issue while updating users"
})
    }
}




module.exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
    
    try {
  
        const user = await userModel.findOne({ _id: id });
        
        if (!user) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        
        await userModel.findByIdAndUpdate(id, {
            $set: {
                email: user.email + '_deletedUser_' + id,
                 status:'inactive'
            }
        });

    
        let orders = await orderModel.find({
            user: id, 
            status: { $in: ['confirmed'] }
        });

      
        if (orders.length === 0) {
            return res.status(200).json({
                message: "User deleted successfully"
            });
        }

       
        const pausePromises = orders.map(async (order) => {
            try {
                if (!order.subscriptionId) {
                    console.log(`Order ${order._id} has no subscription ID`);
                    return { orderId: order._id, success: false, error: 'No subscription ID' };
                }

          
                try {
                    await stripe.subscriptions.update(order.subscriptionId, {
                        pause_collection: {
                            behavior: 'void'
                        }
                    });
                } catch (stripeError) {
                    console.error(`Failed to pause Stripe subscription ${order.subscriptionId}:`, stripeError.message);
                }

             
                await orderModel.findByIdAndUpdate(order._id, {
                    status: 'paused',
                    pausedAt: new Date()
                });

                return { orderId: order._id, success: true };
            } catch (error) {
                console.error(`Error processing order ${order._id}:`, error.message);
                return { orderId: order._id, success: false, error: error.message };
            }
        });

      
        const results = await Promise.all(pausePromises);

       
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        console.log(`Paused ${successCount} subscriptions, ${failCount} failed`);

        return res.status(200).json({
            message: "User deleted successfully",
            subscriptionsPaused: successCount,
            subscriptionsFailed: failCount,
            details: results
        });

    } catch (e) {
        console.error('Delete user error:', e.message);
        return res.status(500).json({
            error: "Error while deleting user",
            details: e.message
        });
    }
};






module.exports.deleteVendor = async (req, res) => {
    const { id } = req.params;
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
    
    try {
    
        const vendorfound = await vendor.findOne({ _id: id });
        
        if (!vendorfound) {
            return res.status(404).json({
                error: "Vendor not found"
            });
        }

       
        await vendor.findByIdAndUpdate(id, {
            $set: {
                email: vendorfound.email + '_deletedVendor_' + id,
                status:'inactive'
            }
        });

      
        let orders = await orderModel.find({
            user: id, 
            status: { $in: ['processing'] }
        });

     
        if (orders.length === 0) {
            return res.status(200).json({
                message: "Vendor deleted successfully"
            });
        }

   
        const pausePromises = orders.map(async (order) => {
            try {
                if (!order.subscriptionId) {
                    console.log(`Order ${order._id} has no subscription ID`);
                    return { orderId: order._id, success: false, error: 'No subscription ID' };
                }

               
                try {
                    await stripe.subscriptions.update(order.subscriptionId, {
                        pause_collection: {
                            behavior: 'void'
                        }
                    });
                } catch (stripeError) {
                    console.error(`Failed to pause Stripe subscription ${order.subscriptionId}:`, stripeError.message);
                }

              
                await orderModel.findByIdAndUpdate(order._id, {
                    status: 'paused',
                    pausedAt: new Date()
                });

                await listingModel.updateMany({vendor:id},{
                    $set:{
                        status:"inactive"
                    }
                })
                return { orderId: order._id, success: true };
            } catch (error) {
                console.error(`Error processing order ${order._id}:`, error.message);
                return { orderId: order._id, success: false, error: error.message };
            }
        });

     
        const results = await Promise.all(pausePromises);

       
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        console.log(`Paused ${successCount} subscriptions, ${failCount} failed`);

        return res.status(200).json({
            message: "User deleted successfully",
            subscriptionsPaused: successCount,
            subscriptionsFailed: failCount,
            details: results
        });

    } catch (e) {
        console.error('Delete user error:', e.message);
        return res.status(500).json({
            error: "Error while deleting user",
            details: e.message
        });
    }
};

module.exports.updateProduct = async (req, res) => {
    let { ...data } = req.body;
    let { id } = req.params;
 
    try {
      
        if (req.file) {
            console.log('File received:', req.file.path);
          
            const cloudinaryResult = await cloudinaryUploadImage(req.file.path);
            
            if (cloudinaryResult.url) {
            
                data.images = [{
                    url: cloudinaryResult.url,
                    publicId: cloudinaryResult.public_id || ''
                }];
                console.log('Image uploaded to Cloudinary:', cloudinaryResult.url);
                
       
                fs.unlinkSync(req.file.path);
            } else {
                throw new Error('Failed to upload image to Cloudinary');
            }
        }
        
        
        if (data['pricing[rentPrice]'] || data['pricing[buyPrice]']) {
            data.pricing = {
                rentPrice: parseFloat(data['pricing[rentPrice]']) || 0,
                buyPrice: parseFloat(data['pricing[buyPrice]']) || 0
            };
            delete data['pricing[rentPrice]'];
            delete data['pricing[buyPrice]'];
        }

    
        const specifications = {};
        Object.keys(data).forEach(key => {
            if (key.startsWith('specifications[')) {
                const specKey = key.match(/specifications\[(.*?)\]/)[1];
                specifications[specKey] = data[key];
                delete data[key];
            }
        });
        if (Object.keys(specifications).length > 0) {
            data.specifications = specifications;
        }
        
     
        const updatedProduct = await listingModel.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true } 
        ).populate('vendor', 'name businessName email'); 
        
        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                error: "Product not found"
            });
        }
        
        return res.status(200).json({
            success: true,
            message: "Product updated successfully",
            product: updatedProduct
        });
    } catch (e) {
        console.log('Error updating product:', e.message);
        return res.status(400).json({
            success: false,
            error: "Facing issue while updating product: " + e.message
        });
    }
}


module.exports.getProducts = async (req, res) => {
  
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        const category = req.query.category || 'all';
        const condition = req.query.condition || 'all';
        const price = req.query.price || 'all';
        
        const skip = (page - 1) * limit;
        
        let searchQuery = {};
        
        
        if (search) {
            searchQuery.$or = [
                { title: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
      
     
        if (status !== 'all') {
            searchQuery.status = status;
        }

    
        if (category !== 'all') {
            searchQuery.category = category;
        }

        
        if (condition !== 'all') {
            searchQuery.condition = condition;
        }

       
        if (price !== 'all') {
            switch (price) {
                case 'low':
                    searchQuery['pricing.rentPrice'] = { $lte: 50 };
                    break;
                case 'medium':
                    searchQuery['pricing.rentPrice'] = { $gt: 50, $lte: 150 };
                    break;
                case 'high':
                    searchQuery['pricing.rentPrice'] = { $gt: 150 };
                    break;
            }
        }
        
     
        const totalProducts = await listingModel.countDocuments(searchQuery);
        
       
        const products = await listingModel.find(searchQuery)
            .populate('vendor', 'name businessName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        const totalPages = Math.ceil(totalProducts / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        console.log("PRODUCTS ARE")
        
     console.log(products)
        return res.status(200).json({
            products,
            pagination: {
                currentPage: page,
                totalPages,
                totalProducts,
                limit,
                hasNext,
                hasPrev
            }
        });

    } catch (e) {
        console.log(e.message);
        return res.status(400).json({
            error: "Facing issue while fetching products"
        });
    }
}


module.exports.getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        const paymentStatus = req.query.paymentStatus || 'all';
        const transferStatus = req.query.transferStatus || 'all';
        
        const skip = (page - 1) * limit;
        
        let searchQuery = {};
        
   
        if (search) {
            searchQuery.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { subscriptionId: { $regex: search, $options: 'i' } },
                { trackingNumber: { $regex: search, $options: 'i' } },
                { paymentIntentId: { $regex: search, $options: 'i' } },
                { 'deliveryAddress.street': { $regex: search, $options: 'i' } },
                { 'deliveryAddress.city': { $regex: search, $options: 'i' } },
                { 'deliveryAddress.zipCode': { $regex: search, $options: 'i' } }
            ];
        }
        
        
        if (status !== 'all') {
            searchQuery.status = status;
        }
        
        
        if (paymentStatus !== 'all') {
            searchQuery.paymentStatus = paymentStatus;
        }
        
      
        if (transferStatus !== 'all') {
            searchQuery.transferStatus = transferStatus;
        }
        
       
        const totalOrders = await orderModel.countDocuments(searchQuery);
        
        
        const orders = await orderModel.find(searchQuery)
            .populate('user', 'name email phone')
            .populate('vendor', 'name businessName email phone')
            .populate('listing', 'title category pricing images')
            .populate('request', 'requestType status')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); 
        
    
        const totalPages = Math.ceil(totalOrders / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
        return res.status(200).json({
            success: true,
            orders,
            pagination: {
                currentPage: page,
                totalPages,
                totalOrders,
                limit,
                hasNext,
                hasPrev
            }
        });

    } catch (e) {
        console.log('Error fetching orders:', e.message);
        return res.status(400).json({
            success: false,
            error: "Facing issue while fetching orders: " + e.message
        });
    }
}



module.exports.pauseSubscription = async (req, res) => {
    
const stripe = require('stripe')(process.env.STRIPE_LIVE);
    try {
        let {subscriptionId}=req.params
        
        let order = await orderModel.findOne({_id:subscriptionId})
       

      
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


        return res.status(200).json({
            message:"Subscription paused sucessfully"
        })

    } catch (e) {
        console.log("Pause billing error:", e.message);
        return res.status(500).json({
            error: "Facing issue while pausing billing please try again",
            details: e.message
        });
    }
}





module.exports.unPauseSubscription = async (req, res) => {
    
const stripe = require('stripe')(process.env.STRIPE_LIVE);
    try {
        let { subscriptionId } = req.params;
        
        console.log('Unpausing subscription for ID:', subscriptionId);
        
        let order = await orderModel.findOne({ _id: subscriptionId });
        
        if (!order) {
            return res.status(404).json({
                error: "Order not found"
            });
        }

        console.log('Current order status:', order.status);
        console.log('Current subscriptionId:', order.subscriptionId);

       
        const subscription = await stripe.subscriptions.update(
            order.subscriptionId,
            {
                pause_collection: '' 
            }
        );

        console.log('Stripe subscription update response:', subscription.status);

      
        const updatedOrder = await orderModel.findByIdAndUpdate(
            order._id, 
            {
                $set: { 
                    status: 'active',
                 
                    billingPaused: false
                },
                $unset: { pausedAt: 1 }
            },
            { new: true } 
        );

        console.log('Updated order:', updatedOrder);

        return res.status(200).json({
            message: "Subscription unpaused successfully",
            order: updatedOrder
        });

    } catch (e) {
        console.log("Unpause billing error:", e.message);
        return res.status(500).json({
            error: "Facing issue while unpausing billing please try again",
            details: e.message
        });
    }
}


module.exports.getDashboardData=async(req,res)=>{
    
    try{
let users=await userModel.find({})
let products=await Product.find({})
let orders=await orderModel.find({})

return res.status(200).json({
    users,
    products,
    orders
})

    }catch(e){
        console.log("Unpause billing error:", e.message);
        return res.status(500).json({
            error: "Facing issue while fetching data",
           
        });
    }
}

module.exports.createAdmin=async(req,res)=>{
    let {...data}=req.body;
    try{
await adminModel.create(data)
return res.status(200).json({
    message:"Admin created sucessfully"
})
    }catch(e){
console.log(e.message)
return res.status(400).json({
    error:"Error while creating admin"
})
    }
}



module.exports.loginAdmin=async(req,res)=>{
    let {...data}=req.body;
    try{
let emailCorrect=await adminModel.findOne({email:data.email})
if(!emailCorrect){
    return res.status(400).json({
        error:"No admin with this email found"
    })
}


let passwordMatch=await adminModel.findOne({password:data.password})
if(!passwordMatch){
    return res.status(400).json({
        error:"Password is incorrect"
    })
}

return res.status(200).json({
    message:"Logged in sucessfully"
})
    }catch(e){
console.log(e.message)
return res.status(400).json({
    error:"Error while creating admin"
})
    }
}



module.exports.resetAdmin=async(req,res)=>{
    let {...data}=req.body;
    try{
let emailCorrect=await adminModel.findOne({email:data.email})
if(!emailCorrect){
    return res.status(400).json({
        error:"No admin with this email found"
    })
}


await adminModel.findByIdAndUpdate(emailCorrect._id,{
    $set:{
        password:data.password
    }
})

return res.status(200).json({
    message:"Password reseted sucessfully"
})
    }catch(e){
console.log(e.message)
return res.status(400).json({
    error:"Error while creating admin"
})
    }
}





module.exports.getRentals = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        const paymentStatus = req.query.paymentStatus || 'all';
        const transferStatus = req.query.transferStatus || 'all';
        
        const skip = (page - 1) * limit;
        
       
        let searchQuery = {
            status: { $in: ['confirmed', 'paused'] }
        };
        
        
        if (status !== 'all') {
            searchQuery.status = status;
        }
        
       
        if (search) {
            searchQuery.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { subscriptionId: { $regex: search, $options: 'i' } },
                { trackingNumber: { $regex: search, $options: 'i' } },
                { paymentIntentId: { $regex: search, $options: 'i' } },
                { 'deliveryAddress.street': { $regex: search, $options: 'i' } },
                { 'deliveryAddress.city': { $regex: search, $options: 'i' } },
                { 'deliveryAddress.zipCode': { $regex: search, $options: 'i' } }
            ];
        }
    
        if (paymentStatus !== 'all') {
            searchQuery.paymentStatus = paymentStatus;
        }
        
        if (transferStatus !== 'all') {
            searchQuery.transferStatus = transferStatus;
        }
        
        const totalOrders = await orderModel.countDocuments(searchQuery);
        
        const orders = await orderModel.find(searchQuery)
            .populate('user', 'name email phone')
            .populate('vendor', 'name businessName email phone')
            .populate('listing', 'title category pricing images')
            .populate('request', 'requestType status')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); 
    
        const totalPages = Math.ceil(totalOrders / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
        return res.status(200).json({
            success: true,
            orders,
            pagination: {
                currentPage: page,
                totalPages,
                totalOrders,
                limit,
                hasNext,
                hasPrev
            }
        });

    } catch (e) {
        console.log('Error fetching orders:', e.message);
        return res.status(400).json({
            success: false,
            error: "Facing issue while fetching orders: " + e.message
        });
    }
}


module.exports.updateStatus=async(req,res)=>{
    let {newStatus}=req.body;
    let {id}=req.params;
    try{
let order=await orderModel.findByIdAndUpdate(id,{
    $set:{
        status:newStatus
    }
},{
    new:true
})

const stripe = require('stripe')(process.env.STRIPE_LIVE);

let updateData = {
};

if (newStatus === "confirmed") {

  updateData.pause_collection = null;
} else {
 
  updateData.pause_collection = {
    behavior: 'mark_uncollectible' 
  };
}

const subscription = await stripe.subscriptions.update(
  order.subscriptionId,
  updateData
);




return res.status(200).json({
    message:`Rental ${newStatus} sucessfully`
})

    }catch(e){
console.log(e.message)
return res.status(400).json({
    error:"Error occured while trying to update the status of rental"
})        

    }
}


module.exports.supportSendMessage = async(req, res) => {
    console.log('Request body:', req.body);
    
    const { message, ticketId, userType } = req.body;
    const userId=req?.user?._id?req?.user?._id:req?.user?.id
    
    if (!message || !userId || !userType) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: { message: !!message, userId: !!userId, userType: !!userType }
      });
    }
    
    try {
      let ticket;
      
      if (!ticketId) {
        ticket = await SupportTicket.create({
          userId: userId,
          userType: userType,
          status: 'open',
          lastMessageAt: new Date()
        });
        console.log('Created new ticket:', ticket._id);
      } else {
        ticket = await SupportTicket.findById(ticketId);
        if (!ticket) {
          return res.status(404).json({ error: 'Ticket not found' });
        }
        ticket.lastMessageAt = new Date();
        ticket.status = 'open'; 
        await ticket.save();
        console.log('Updated existing ticket:', ticket._id);
      }
      
    
      const messageData = {
        ticketId: ticket._id,
        sentBy: userType, 
        senderId: userId,
        senderModel: userType === 'vendor' ? 'Vendor' : 'user',
        message: message,
        seenByUser: true, 
        seenByAdmin: false
      };
      
     
      console.log('Message data to be created:', JSON.stringify(messageData, null, 2));
      
     
      console.log('Field check:', {
        'ticketId exists': !!messageData.ticketId,
        'ticketId value': messageData.ticketId,
        'sentBy exists': !!messageData.sentBy,
        'sentBy value': messageData.sentBy,
        'senderId exists': !!messageData.senderId,
        'senderId value': messageData.senderId,
        'senderModel exists': !!messageData.senderModel,
        'senderModel value': messageData.senderModel,
        'message exists': !!messageData.message,
        'message value': messageData.message
      });
      
      const newMessage = await SupportMessage.create(messageData);
      
      console.log('Message created successfully:', newMessage._id);

      if (typeof io !== 'undefined' && io) {
        io.to('admin-room').emit('newSupportMessage', {
          ticketId: ticket._id,
          message: newMessage,
          userType: userType
        });
      }
      
      res.json({ 
        success: true, 
        ticketId: ticket._id,
        messageId: newMessage._id 
      });
      
    } catch (error) {
      console.log('Error in supportSendMessage:', error);
      res.status(500).json({ error: error.message });
    }
  };


module.exports.adminsupportsendmessage=async(req,res)=>{
    const { ticketId, message,adminId="6920a166feae6e4743875b16" } = req.body;
    
    try {
      const ticket = await SupportTicket.findById(ticketId);
      
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      
   
      ticket.lastMessageAt = new Date();
      ticket.status = 'pending'; 
      if (!ticket.assignedAdmin) {
        ticket.assignedAdmin = adminId;
      }
      await ticket.save();
      
    
      const newMessage = await SupportMessage.create({
        ticketId: ticketId,
        sentBy: 'admin',
        senderId: adminId,
        senderModel: 'admin',
        message: message,
        seenByAdmin: true,
        seenByUser: false
      });
     
   
      
      res.json({ success: true, messageId: newMessage._id });
      
    } catch (error) {
        console.log(error.message)
      res.status(500).json({ error: error.message });
    }
}


module.exports.getAllTicketsForAdmins=async(req,res)=>{
    const { status, userType, search, page = 1, limit = 20 } = req.query;
  
  try {
    const query = {};
    
    if (status && status !== 'all') {
        query.status = status;
      } else {
       
        query.status = { $ne: 'closed' };
      }


    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (userType && userType !== 'all') {
      query.userType = userType;
    }
    
    const tickets = await SupportTicket.find(query)
      .populate('userId', 'name email avatar')
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
 
    const ticketsWithUnread = await Promise.all(
      tickets.map(async (ticket) => {
        const unreadCount = await SupportMessage.countDocuments({
          ticketId: ticket._id,
          sentBy: { $ne: 'admin' },
          seenByAdmin: false
        });
        
        const lastMessage = await SupportMessage.findOne({
          ticketId: ticket._id
        }).sort({ createdAt: -1 });
        
        return {
          ...ticket.toObject(),
          unreadCount,
          lastMessage
        };
      })
    );
    
    res.json({ tickets: ticketsWithUnread });
    
  } catch (error) {
    console.log(error.message)
    res.status(500).json({ error: error.message });
  }
}








module.exports.supportmessageTickets=async(req,res)=>{
    const { ticketId } = req.params;
  
  try {
    const messages = await SupportMessage.find({ ticketId })
      .sort({ createdAt: 1 })
      .populate('senderId', 'name email avatar');
    
    res.json({ messages });
    
  } catch (error) {
    console.log(error.message)
    res.status(500).json({ error: error.message });
  }
}

module.exports.markMessageAsRead = async (req, res) => {
    const { ticketId } = req.params;
    const {userRole} = req.body; 
    
    try {
    
      let query = { ticketId };
      let updateField;
      
      if (userRole === 'admin') {
      
        query.sentBy = { $ne: 'admin' };
        query.seenByAdmin = false; 
        updateField = { seenByAdmin: true };
      } else {
       
        query.sentBy = 'admin';
        query.seenByUser = false; 
        updateField = { seenByUser: true };
      }
      
      await SupportMessage.updateMany(
        query,
        { 
          $set: { 
            ...updateField,
            seenAt: new Date() 
          } 
        }
      );
      
      res.json({ success: true });
      
    } catch (error) {
        console.log(error.message)
      res.status(500).json({ error: error.message });
    }
  };



  module.exports.getUserTicket = async(req, res) => {
    const {  userType } = req.query;
    console.log(userType)
    try {
        let userId=req?.user?._id?req?.user?._id:req.user.id
        console.log(userId)
      const tickets = await SupportTicket.find({ 
        userId: userId,
        userType: userType,
        status: { $ne: 'closed' } 
      })
      .populate('userId', 'name email')
      .sort({ lastMessageAt: -1 })
      .limit(1); 
      
      if (!tickets || tickets.length === 0) {
        return res.json({ ticket: null, messages: [] });
      }
      
      const ticket = tickets[0];
      
      const messages = await SupportMessage.find({ ticketId: ticket._id })
        .sort({ createdAt: 1 })
        .populate('senderId', 'name email');
      
      res.json({ ticket, messages });
    } catch (error) {
        console.log(error.message)
      res.status(500).json({ error: error.message });
    }
  };




  

  module.exports.getCurrentAdmin = async(req, res) => {
  
    let { email } = req.query;
    
    try {
      let currentAdmin = await adminModel.findOne({ email });
      
      if (!currentAdmin) {
        return res.status(404).json({
          error: "Admin not found"
        });
      }
      
      return res.status(200).json({
        currentAdmin
      });
    } catch(e) {
      console.log(e.message);
      return res.status(400).json({
        error: "Error occurred while trying to get Admin"
      });
    }
  }