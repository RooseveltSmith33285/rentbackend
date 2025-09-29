const userModel = require('../models/user');
const jwt = require('jsonwebtoken'); 
const nodemailer=require('nodemailer')
module.exports.register = async (req, res) => {
    let { ...data } = req.body;
    
    try {
      
        let alreadyExists = await userModel.findOne({ email: data.email });
        if (alreadyExists) {
            return res.status(400).json({
                error: "User already exists"
            });
        }

      
        let user = await userModel.create(data);
        
      
        let userToken = jwt.sign({ _id: user._id, email: user.email }, process.env.JWT_KEY, {
            expiresIn: '7d'
        });


        const mailOptions = {
            from: 'orders@enrichifydata.com',
            to: 'lemightyeagle@gmail.com',
            subject: 'New User Registration - Shipmate',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <!-- Header -->
                <div style="background-color: #e74c3c; padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px;">New User Registration</h1>
                  <p style="color: #ecf0f1; margin-top: 10px; font-size: 16px;">A new user has joined the platform</p>
                </div>
                
                <!-- Registration Time -->
                <div style="padding: 20px; background-color: #f8f9fa; border-bottom: 2px solid #e9ecef;">
                  <p style="margin: 0; color: #7f8c8d; font-size: 14px;">Registration Date & Time</p>
                  <h2 style="margin: 5px 0 0 0; color: #2c3e50; font-size: 20px;">${new Date().toLocaleString('en-US', { 
                    dateStyle: 'full', 
                    timeStyle: 'short' 
                  })}</h2>
                </div>
          
                <!-- User Information -->
                <div style="padding: 30px;">
                  <h3 style="color: #2c3e50; border-bottom: 2px solid #e74c3c; padding-bottom: 10px; margin-top: 0;">
                    User Details
                  </h3>
                  
                  <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <tr>
                      <td style="padding: 12px; background-color: #f8f9fa; width: 35%; font-weight: 600; color: #2c3e50;">Full Name</td>
                      <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057;">${user?.name}</td>
                    </tr>
                   
                    <tr>
                      <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">Email Address</td>
                      <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057;">${user?.email}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">Phone Number</td>
                      <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057;">${user?.mobile}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">User ID</td>
                      <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057;">#USER-${Date.now()}</td>
                    </tr>
                  </table>
          
                  <!-- Action Required -->
                
                 
          
                
                 
                </div>
          
                <!-- Footer -->
                <div style="background-color: #2c3e50; padding: 20px; text-align: center;">
                  <p style="margin: 0; color: #ecf0f1; font-size: 12px;">
                    This is an automated notification email from your admin panel.
                  </p>
                  <p style="margin: 10px 0 0 0; color: #95a5a6; font-size: 11px;">
                    © 2025 ENRICHIFY. All rights reserved.
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

        return res.status(201).json({
            token: userToken,
            message: "User registered successfully"
        });
    } catch (e) {
        console.log(e.message);
        return res.status(500).json({
            error: "Facing issue while registering please try again",
            details: e.message
        });
    }
};

module.exports.login = async (req, res) => {
    let { email, password } = req.body;
    
    try {
    
        let userFound = await userModel.findOne({ email });
        if (!userFound) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        let passwordMatch = await userModel.findOne({password:password});
       
        
        if (!passwordMatch) {
            return res.status(401).json({
                error: "Invalid Password"
            });
        }

        let userToken = jwt.sign({ _id: userFound._id, email: userFound.email }, process.env.JWT_KEY, {
           
        });

        return res.status(200).json({
            message: "User logged in successfully",
            token: userToken
        });
    } catch (e) {
        console.log(e.message);
        return res.status(500).json({
            error: "Facing issue while login please try again",
            details: e.message
        });
    }
};


module.exports.getUser=async(req,res)=>{
    try{
let user=await userModel.findById(req.user._id)
return res.status(200).json({
    user
})
    }catch(e){
        console.log(e.message);
        return res.status(500).json({
            error: "Facing issue while fetching user please try again",
            details: e.message
        });
    }
}

module.exports.resetPassword=async(req,res)=>{
    let {email,password}=req.body;
    try{

        let userFound=await userModel.findOne({email})
        if(!userFound){
return res.status(400).json({
    error:"No user found with this email"
})
        }
        let user=await userModel.updateOne({email},{
            $set:{
                password
            }
        })
        return res.status(200).json({
            message:"Password updated sucessfully"
        })
            }catch(e){
                console.log(e.message);
                return res.status(500).json({
                    error: "Facing issue while updating password please try again",
                    details: e.message
                });
            }
}