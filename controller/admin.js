


let {cloudinaryUploadImage}=require('../middleware/cloudinary')
const fs=require('fs')


const orderModel = require('../models/order');
const listingModel=require('../models/listing')
const Product = require('../models/products');
const userModel=require('../models/user');
const adminModel = require('../models/admin');
const vendor=require('../models/vendor')

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
       
   // Remove the deletedUser filter or make it optional

// OR if you want to keep it but make it work with missing fields:
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
                searchQuery.isActive = true;  // Use isActive from your vendor model
            } else if (status === 'suspended') {
                searchQuery.isActive = false;  // Use isActive from your vendor model
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
                    totalRevenue: { $sum: '$vendorPayout' }, // Sum of vendor payouts
                    totalOrders: { $sum: 1 }
                }
            }
        ]);
        
        // Create a map for quick lookup
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
        // Check if user exists
        const user = await userModel.findOne({ _id: id });
        
        if (!user) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        // Update user to mark as deleted
        await userModel.findByIdAndUpdate(id, {
            $set: {
                email: user.email + '_deletedUser_' + id,
                 status:'inactive'
            }
        });

        // Find user's confirmed orders
        let orders = await orderModel.find({
            user: id, // Use the id parameter, not req.user._id
            status: { $in: ['confirmed'] }
        });

        // If no orders, return success
        if (orders.length === 0) {
            return res.status(200).json({
                message: "User deleted successfully"
            });
        }

        // Pause all subscriptions
        const pausePromises = orders.map(async (order) => {
            try {
                if (!order.subscriptionId) {
                    console.log(`Order ${order._id} has no subscription ID`);
                    return { orderId: order._id, success: false, error: 'No subscription ID' };
                }

                // Cancel/pause subscription in Stripe
                try {
                    await stripe.subscriptions.update(order.subscriptionId, {
                        pause_collection: {
                            behavior: 'void'
                        }
                    });
                } catch (stripeError) {
                    console.error(`Failed to pause Stripe subscription ${order.subscriptionId}:`, stripeError.message);
                }

                // Update order status in database
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

        // Wait for all pause operations to complete
        const results = await Promise.all(pausePromises);

        // Check results
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
        // Check if user exists
        const vendorfound = await vendor.findOne({ _id: id });
        
        if (!vendorfound) {
            return res.status(404).json({
                error: "Vendor not found"
            });
        }

        // Update user to mark as deleted
        await vendor.findByIdAndUpdate(id, {
            $set: {
                email: vendorfound.email + '_deletedVendor_' + id,
                status:'inactive'
            }
        });

        // Find user's confirmed orders
        let orders = await orderModel.find({
            user: id, // Use the id parameter, not req.user._id
            status: { $in: ['processing'] }
        });

        // If no orders, return success
        if (orders.length === 0) {
            return res.status(200).json({
                message: "Vendor deleted successfully"
            });
        }

        // Pause all subscriptions
        const pausePromises = orders.map(async (order) => {
            try {
                if (!order.subscriptionId) {
                    console.log(`Order ${order._id} has no subscription ID`);
                    return { orderId: order._id, success: false, error: 'No subscription ID' };
                }

                // Cancel/pause subscription in Stripe
                try {
                    await stripe.subscriptions.update(order.subscriptionId, {
                        pause_collection: {
                            behavior: 'void'
                        }
                    });
                } catch (stripeError) {
                    console.error(`Failed to pause Stripe subscription ${order.subscriptionId}:`, stripeError.message);
                }

                // Update order status in database
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

        // Wait for all pause operations to complete
        const results = await Promise.all(pausePromises);

        // Check results
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
        // Handle image upload if present
        if (req.file) {
            console.log('File received:', req.file.path);
          
            const cloudinaryResult = await cloudinaryUploadImage(req.file.path);
            
            if (cloudinaryResult.url) {
                // Store in images array format to match your schema
                data.images = [{
                    url: cloudinaryResult.url,
                    publicId: cloudinaryResult.public_id || ''
                }];
                console.log('Image uploaded to Cloudinary:', cloudinaryResult.url);
                
                // Delete local file
                fs.unlinkSync(req.file.path);
            } else {
                throw new Error('Failed to upload image to Cloudinary');
            }
        }
        
        // Parse pricing if it comes as separate fields
        if (data['pricing[rentPrice]'] || data['pricing[buyPrice]']) {
            data.pricing = {
                rentPrice: parseFloat(data['pricing[rentPrice]']) || 0,
                buyPrice: parseFloat(data['pricing[buyPrice]']) || 0
            };
            delete data['pricing[rentPrice]'];
            delete data['pricing[buyPrice]'];
        }

        // Parse specifications if they exist
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
        
        // Update product and return the UPDATED document with vendor populated
        const updatedProduct = await listingModel.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true } // new: true returns updated document
        ).populate('vendor', 'name businessName email'); // Populate vendor details
        
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
        
        // Search functionality
        if (search) {
            searchQuery.$or = [
                { title: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
      
        // Filter by status
        if (status !== 'all') {
            searchQuery.status = status;
        }

        // Filter by category
        if (category !== 'all') {
            searchQuery.category = category;
        }

        // Filter by condition
        if (condition !== 'all') {
            searchQuery.condition = condition;
        }

        // Filter by price range (using rentPrice)
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
        
        // Count total products
        const totalProducts = await listingModel.countDocuments(searchQuery);
        
        // Fetch products with pagination
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
        
        // Search across multiple fields
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
        
        // Filter by order status
        if (status !== 'all') {
            searchQuery.status = status;
        }
        
        // Filter by payment status
        if (paymentStatus !== 'all') {
            searchQuery.paymentStatus = paymentStatus;
        }
        
        // Filter by transfer status
        if (transferStatus !== 'all') {
            searchQuery.transferStatus = transferStatus;
        }
        
        // Count total orders matching the query
        const totalOrders = await orderModel.countDocuments(searchQuery);
        
        // Fetch orders with populated fields
        const orders = await orderModel.find(searchQuery)
            .populate('user', 'name email phone')
            .populate('vendor', 'name businessName email phone')
            .populate('listing', 'title category pricing images')
            .populate('request', 'requestType status')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); // Use lean() for better performance
        
        // Calculate pagination
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