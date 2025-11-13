const Vendor = require('../models/vendor');
const jwt = require('jsonwebtoken');
const userModel=require('../models/user')
const messageModel=require('../models/messages')
const CommunityPost=require('../models/communitypost')
const Listing=require('../models/listing');
const nodemailer=require('nodemailer')
const {cloudinaryUploadImage}=require('../middleware/cloudinary')

const requestModel = require('../models/request');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_KEY || 'your-secret-key-here-change-in-production', {
      expiresIn: '30d'
    });
  };


  exports.vendorSignup = async (req, res) => {
    try {
      const { name, email, mobile, password, businessName } = req.body;
  
      // Validation
      if (!name || !email || !mobile || !password) {
        return res.status(400).json({ error: 'Please provide all required fields' });
      }
  
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Please provide a valid email address' });
      }
  
      // Password validation
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
  
      // Check if vendor already exists
      const existingVendor = await Vendor.findOne({ email: email.toLowerCase() });
      if (existingVendor) {
        return res.status(400).json({ error: 'Email already registered' });
      }
  
   
      // Create vendor
      const vendor = await Vendor.create({
        name,
        email: email.toLowerCase(),
        mobile,
        password: password,
        businessName: businessName || '',
        subscription: {
          plan: 'free',
          status: 'trial',
          startDate: new Date(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days trial
        }
      });
  
      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        vendor: {
          _id: vendor._id,
          name: vendor.name,
          email: vendor.email,
          mobile: vendor.mobile,
          businessName: vendor.businessName
        }
      });
  
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }
  };




  exports.vendorLogin = async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and password' });
      }
  
      // Check if vendor exists and include password field
      const vendor = await Vendor.findOne({ email: email.toLowerCase() }).select('+password');
      if (!vendor) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
  
      // Check if vendor is active
      if (!vendor.isActive) {
        return res.status(403).json({ error: 'Account is deactivated. Contact support.' });
      }
  
      // Verify password
      const isPasswordValid = await Vendor.findOne({password})
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
  
      // Generate token
      const token = generateToken(vendor._id);
  
      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        vendor: {
          _id: vendor._id,
          name: vendor.name,
          email: vendor.email,
          mobile: vendor.mobile,
          businessName: vendor.businessName,
          subscription: vendor.subscription,
          isVerified: vendor.isVerified
        }
      });
  
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  };




  exports.getVendorProfile=async(req,res)=>{
    try{
      let id=req?.user?._id?req?.user?._id:req.user.id
let vendor=await Vendor.findById(id)
return res.status(200).json({
  vendor
})

    }catch(e){
      console.log(e.message)
      return res.status(400).json({
        error:"Error occured while trying to fetch profile"
      })
    }
  }





  exports.resetPassword = async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and new password' });
      }
  
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Please provide a valid email address' });
      }
  
      // Password validation
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
  
      // Find vendor
      const vendor = await Vendor.findOne({ email: email.toLowerCase() });
      if (!vendor) {
        return res.status(404).json({ error: 'No account found with this email address' });
      }
  
      // Check if vendor is active
      if (!vendor.isActive) {
        return res.status(403).json({ error: 'Account is deactivated. Contact support.' });
      }
  
     vendor.password=password
      // Clear any existing reset tokens
      vendor.resetPasswordToken = undefined;
      vendor.resetPasswordExpire = undefined;
  
      await vendor.save();
  
      res.status(200).json({
        success: true,
        message: 'Password reset successful. You can now login with your new password.'
      });
  
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password. Please try again.' });
    }
  };







  module.exports.getVendorInfo=async(req,res)=>{
    let {id}=req.params;
    try{
let vendor=await Vendor.findOne({_id:id})
return res.status(200).json({
  vendor
})

    }catch(e){
      return res.status(400).json({
        error:"Error occured while trying to get vendor info"
      })
    }
  }
























  exports.sendMessage=async(req,res)=>{
    let {...data}=req.body;
    let id=req?.user?._id?req?.user?._id:req.user.id
    try{
        data={
            ...data,
            vendor:id,
            sendBy:'vendor'
        }
let message=await messageModel.create(data)
return res.status(200).json({
    message:"Message sent sucessfully",
    id:message._id
})
    }catch(e){
console.log(e.message)
return res.status(400).json({
    error:"Error occured while trying to send message"
})
    }
}

exports.getMessages=async(req,res)=>{
    let {user}=req.params;
    let id=req?.user?._id?req?.user?._id:req.user.id
    
    try{
let messages=await messageModel.find({vendor:id,user}).populate('user')
console.log("messages")
return res.status(200).json({
    messages
})

    }catch(e){
      console.log("Error")
console.log(e.message)
return res.status(400).json({
    error:"Error occured while trying to fetch messages"
})
    }
}

exports.getConversations=async(req,res)=>{
    try{
      let id=req?.user?._id?req?.user?._id:req.user.id
     
        let conversations=await messageModel.find({vendor:id}).populate('user')
     
        return res.status(200).json({
            conversations
        })
    }catch(e){
        console.log(e.message)
        return res.status(400).json({
            error:"Error occured while trying to fetch conversations"
        })
    }
}

exports.getConversation=async(req,res)=>{
    const {user}=req.params;
    try{
      let id=req?.user?._id?req?.user?._id:req.user.id

        let conversation=await messageModel.find({vendor:id,user}).populate('user')
        return res.status(200).json({
            conversation
        })
    }catch(e){
        console.log(e.message)
        return res.status(400).json({
            error:"Error occured while trying to fetch conversation"
        })
    }

}

module.exports.seenMessages=async(req,res)=>{
  let {user}=req.params;
  try{
let id=req?.user?._id?req?.user?._id:req.user.id
await messageModel.updateMany({vendor:id,user},{$set:{
seenByVendor:true
}})
return res.status(200).json({
  message:"Messages seen sucessfully"
})
  }catch(e){
    return res.status(400).json({
      error:"Error occured while trying to update messages"
    })
  }
}



module.exports.getUser=async(req,res)=>{
let {user}=req.params;
  try{
let userData=await userModel.findById(user)
return res.status(200).json({
  user:userData
})

  }catch(e){
    console.log(e.message)
    return res.status(400).json({
      error:"Error while trying to get user"
    })
  }
}


module.exports.getVendorRequests=async(req,res)=>{
  try{
    let id=req?.user?._id?req?.user?._id:req.user.id
let requests=await requestModel.find({vendor:id}).populate('user').populate('listing')
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


module.exports.approveRequest=async(req,res)=>{
  let { id } = req.body;
  try {

    const files = req.files;

    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        error: "Please upload all required images"
      });
    }
    
    const imageUrls = {};
    
    // Process each field
    if (files.front && files.front[0]) {
      const result = await cloudinaryUploadImage(files.front[0].path);
      imageUrls.front = result.url;
    }
    if (files.side && files.side[0]) {
      const result = await cloudinaryUploadImage(files.side[0].path);
      imageUrls.side = result.url;
    }
    if (files.serialTag && files.serialTag[0]) {
      const result = await cloudinaryUploadImage(files.serialTag[0].path);
      imageUrls.serial_tag = result.url;
    }
    if (files.condition && files.condition[0]) {
      const result = await cloudinaryUploadImage(files.condition[0].path);
      imageUrls.condition = result.url;
    }
    
    await requestModel.findByIdAndUpdate(id, {
      $set: {
        approvedByVendor: true,
        images: [imageUrls], 
        status: "approved"
      }
    });

    let request = await requestModel.findById(id).populate('user').populate('listing');

const mailOptions = {
  from: 'orders@enrichifydata.com',
  to: request.user.email, 
  subject: 'Rental Request Approved - RentSimple',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <!-- Header -->
      <div style="background-color: #024a47; padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎉 Your Rental Request is Approved!</h1>
        <p style="color: #ecf0f1; margin-top: 10px; font-size: 16px;">The vendor has accepted your rental offer</p>
      </div>
      
      <!-- Approval Time -->
      <div style="padding: 20px; background-color: #f8f9fa; border-bottom: 2px solid #e9ecef;">
        <p style="margin: 0; color: #7f8c8d; font-size: 14px;">Approved On</p>
        <h2 style="margin: 5px 0 0 0; color: #2c3e50; font-size: 20px;">${new Date().toLocaleString('en-US', { 
          dateStyle: 'full', 
          timeStyle: 'short' 
        })}</h2>
      </div>

      <!-- Product Information -->
      <div style="padding: 30px;">
        <h3 style="color: #2c3e50; border-bottom: 2px solid #024a47; padding-bottom: 10px; margin-top: 0;">
          Product Details
        </h3>
        
        ${request.listing.images && request.listing.images.length > 0 ? `
        <div style="text-align: center; margin: 20px 0;">
          <img src="${request.listing.images.find(img => img.isPrimary)?.url || request.listing.images[0].url}" 
               alt="${request.listing.title}" 
               style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #dee2e6;" />
        </div>
        ` : ''}
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 12px; background-color: #f8f9fa; width: 35%; font-weight: 600; color: #2c3e50;">Product</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057;">${request.listing.title}</td>
          </tr>
          <tr>
            <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">Brand</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057;">${request.listing.brand}</td>
          </tr>
          <tr>
            <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">Category</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057; text-transform: capitalize;">${request.listing.category}</td>
          </tr>
          <tr>
            <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">Condition</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057;">${request.listing.condition}</td>
          </tr>
          <tr>
            <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">Monthly Rent</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; color: #024a47; font-weight: 700; font-size: 18px;">$${request.listing.pricing.rentPrice}/mo</td>
          </tr>
          ${request.deliveryType ? `
          <tr>
            <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">Delivery Type</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057; text-transform: capitalize;">${request.deliveryType}</td>
          </tr>
          ` : ''}
          ${request.installationType ? `
          <tr>
            <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">Installation</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057; text-transform: capitalize;">${request.installationType}</td>
          </tr>
          ` : ''}
        </table>

        <!-- Action Required -->
        <div style="margin-top: 30px; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
          <h4 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">⚠️ Action Required</h4>
          <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
            To complete your rental, please log in to your account and confirm the payment details. 
            Your rental will be processed once payment is confirmed.
          </p>
        </div>

        <!-- Call to Action Button -->
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL || 'https://rentsimple.com'}/renterconfirmation?id=${request._id}" 
             style="display: inline-block; background-color: #024a47; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Accept & Pay Now
          </a>
        </div>

        <!-- Customer Support -->
        <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
          <h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px;">Need Help?</h4>
          <p style="margin: 0; color: #495057; font-size: 14px; line-height: 1.6;">
            If you have any questions about this rental or need assistance, please don't hesitate to contact our support team.
          </p>
        </div>

        <!-- Request ID -->
        <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 4px; text-align: center;">
          <p style="margin: 0; color: #6c757d; font-size: 12px;">Request ID: <strong>#${request._id}</strong></p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #2c3e50; padding: 20px; text-align: center;">
        <p style="margin: 0; color: #ecf0f1; font-size: 12px;">
          This is an automated notification from RentSimple.
        </p>
        <p style="margin: 10px 0 0 0; color: #95a5a6; font-size: 11px;">
          © 2025 RentSimple. All rights reserved.
        </p>
      </div>
    </div>
  `
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
      user: 'rentsimple159@gmail.com', 
      pass: 'upqbbmeobtztqxyg' 
  }
});

const info = await transporter.sendMail(mailOptions);
return res.status(200).json({
  message:"Request approved sucessfully"
})
  }catch(e){
    console.log(e.message)
    return res.status(400).json({
      error:"Error occured while trying to approve request"
    })
  }
}




module.exports.rejectRequest=async(req,res)=>{
  let {id}=req.body;
  try{
await requestModel.findByIdAndUpdate(id,{
  $set:{
    status:"rejected"
  }
})


return res.status(200).json({
  message:"Request approved sucessfully"
})
  }catch(e){
    console.log(e.message)
    return res.status(400).json({
      error:"Error occured while trying to approve request"
    })
  }
}