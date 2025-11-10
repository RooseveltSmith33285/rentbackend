const Vendor = require('../models/vendor');
const jwt = require('jsonwebtoken');
const CommunityPost=require('../models/communitypost')
const Listing=require('../models/listing')

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







  