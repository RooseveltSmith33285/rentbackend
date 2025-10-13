


let {cloudinaryUploadImage}=require('../middleware/cloudinary')
const fs=require('fs')


const orderModel = require('../models/order');
const Product = require('../models/products');
const userModel=require('../models/user');
const adminModel = require('../models/admin');

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




module.exports.deleteUser=async(req,res)=>{
    let {id}=req.params;
   
const stripe = require('stripe')(process.env.STRIPE_LIVE);
    try{
        let user=await userModel.findOne({_id:id})
      await userModel.findByIdAndUpdate(id,{
        $set:{
            email:user.email+'deletedUser'+id,
            deletedUser:true
        }
      })

      let orders = await orderModel.find({
            
        status: { $in: ['active', 'pending'] }
    });
    orders=orders?.filter(u=>u?.user?.toString()==req?.user?._id?.toString())

    if (orders.length === 0) {
        return res.status(200).json({
            message:"User deleted sucessfully"
        })
    }

    
    const pausePromises = orders.map(async(order)=>{
        
          
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

    })
      

        
     
return res.status(200).json({
    message:"User deleted sucessfully"
})

    }catch(e){
console.log(e.message)
return res.status(400).json({
    error:"Facing issue while updating users"
})
    }
}


module.exports.updateProduct=async(req,res)=>{
    let {...data}=req.body;
    let {id}=req.params;
    try{
        if (req.file) {
            console.log('File received:', req.file.path);
          
            const cloudinaryResult = await cloudinaryUploadImage(req.file.path);
            
            if (cloudinaryResult.url) {
             
                data.photo = cloudinaryResult.url;
                console.log('Image uploaded to Cloudinary:', cloudinaryResult.url);
                
                
                fs.unlinkSync(req.file.path);
            } else {
                throw new Error('Failed to upload image to Cloudinary');
            }
        }
        
       
        const newProduct = await Product.findByIdAndUpdate(id,{
            $set:data
        });
        
        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            product: newProduct
        });
    }catch(e){
        console.log(e.message)
        return res.status(400).json({
            error:"Facing issue while updating users"
        })
    }
}



module.exports.getProducts = async (req, res) => {
    try {
       
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        const combo = req.query.combo || 'all';
        const price = req.query.price || 'all';
        
    
        const skip = (page - 1) * limit;
        
       
        let searchQuery = {};
        
    
        if (search) {
            searchQuery.$or = [
                { name: { $regex: search, $options: 'i' } },
                { key_features: { $elemMatch: { $regex: search, $options: 'i' } } }
            ];
        }
      
        if (status !== 'all') {
            searchQuery.stock_status = status;
        }

      
        if (combo !== 'all') {
            searchQuery.combo = combo === 'combo';
        }

   
        if (price !== 'all') {
            switch (price) {
                case 'low':
                    searchQuery.monthly_price = { $lte: 50 };
                    break;
                case 'medium':
                    searchQuery.monthly_price = { $gt: 50, $lte: 150 };
                    break;
                case 'high':
                    searchQuery.monthly_price = { $gt: 150 };
                    break;
            }
        }
        
      
        const totalProducts = await Product.countDocuments(searchQuery);
        
      
        const products = await Product.find(searchQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        

        const totalPages = Math.ceil(totalProducts / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
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
        
      
        const skip = (page - 1) * limit;
        
       
        let searchQuery = {};
        
        if (search) {
            searchQuery.$or = [
                { subscriptionId: { $regex: search, $options: 'i' } },
                { user: { $regex: search, $options: 'i' } },
                { locationName: { $regex: search, $options: 'i' } }
            ];
        }
        
     
        if (status !== 'all') {
            searchQuery.status = status;
        }
        
  
        const totalOrders = await orderModel.countDocuments(searchQuery);
        
       
        const orders = await orderModel.find(searchQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
       
        const totalPages = Math.ceil(totalOrders / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
        return res.status(200).json({
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
        console.log(e.message);
        return res.status(400).json({
            error: "Facing issue while fetching orders"
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