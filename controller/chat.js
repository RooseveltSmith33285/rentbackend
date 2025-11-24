const messageModel = require("../models/messages");
const orderModel = require("../models/order");
const userModel = require("../models/user");
const Vendor=require('../models/vendor')

const nodemailer=require('nodemailer')
exports.sendMessage=async(req,res)=>{
    let {...data}=req.body;
    let id=req?.user?._id?req?.user?._id:req.user.id
    try{
        data={
            ...data,
            user:id,
            sendBy:'user'
        }
let message=await messageModel.create(data)
let vendor=await Vendor.findById(data.vendor)
let user = await userModel.findById(id);

if (vendor && vendor.email) {
    const vendorMailOptions = {
      from: 'orders@enrichifydata.com',
      to: vendor.email,
      subject: 'New Message from Customer - RentSimple',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background-color: #024a47; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">💬 New Message</h1>
            <p style="color: #e9ecef; margin-top: 10px; font-size: 16px;">You have received a new message from a customer</p>
          </div>
          
          <!-- Time -->
          <div style="padding: 20px; background-color: #f8f9fa; border-bottom: 2px solid #e9ecef;">
            <p style="margin: 0; color: #7f8c8d; font-size: 14px;">Received On</p>
            <h2 style="margin: 5px 0 0 0; color: #2c3e50; font-size: 20px;">${new Date().toLocaleString('en-US', { 
              dateStyle: 'full', 
              timeStyle: 'short' 
            })}</h2>
          </div>

          <!-- Main Content -->
          <div style="padding: 30px;">
            <h3 style="color: #2c3e50; border-bottom: 2px solid #024a47; padding-bottom: 10px; margin-top: 0;">
              Message Details
            </h3>
            
            <p style="color: #495057; font-size: 16px; line-height: 1.6; margin-top: 20px;">
              Hello <strong>${vendor.name || vendor.businessName}</strong>,
            </p>
            
            <p style="color: #495057; font-size: 16px; line-height: 1.6;">
              You have received a new message from a customer. Please log in to your dashboard to view and respond.
            </p>

            <!-- Customer Information -->
            <h4 style="color: #2c3e50; margin-top: 30px; margin-bottom: 15px;">Customer Information:</h4>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <tr>
                <td style="padding: 12px; background-color: #f8f9fa; width: 40%; font-weight: 600; color: #2c3e50;">Customer Name</td>
                <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057;">${user?.name || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">Customer Email</td>
                <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057;">${user?.email || 'N/A'}</td>
              </tr>
            </table>

            <!-- Message Preview -->
            <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-left: 4px solid #024a47; border-radius: 4px;">
              <h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px;">Message:</h4>
              <p style="margin: 0; color: #495057; font-size: 14px; line-height: 1.6;">
                "${data.message || 'No message content'}"
              </p>
            </div>

            <!-- Call to Action Button -->
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'https://rentsimple.com'}/vendor/messages" 
                 style="display: inline-block; background-color: #024a47; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View & Reply to Message
              </a>
            </div>

            <!-- Response Reminder -->
            <div style="margin-top: 30px; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
              <h4 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">⏰ Quick Response Recommended</h4>
              <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                Customers appreciate timely responses. Try to reply within 24 hours to maintain good communication.
              </p>
            </div>

            <!-- Support Info -->
            <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
              <h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px;">Need Help?</h4>
              <p style="margin: 0; color: #495057; font-size: 14px; line-height: 1.6;">
                If you have any questions or need assistance, please contact our support team.
              </p>
            </div>

            <!-- Message ID -->
            <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 4px; text-align: center;">
              <p style="margin: 0; color: #6c757d; font-size: 12px;">Message ID: <strong>#${message._id}</strong></p>
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

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'rentsimple159@gmail.com', 
        pass: 'upqbbmeobtztqxyg' 
      }
    });

    transporter.sendMail(vendorMailOptions).catch(err => {
      console.error('Error sending email notification:', err);
    });
  }

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
    let {vendor}=req.body;
    try{
        let id=req?.user?._id?req?.user?._id:req.user.id
let messages=await messageModel.find({user:id,vendor})
return res.status(200).json({
    messages
})

    }catch(e){
console.log(e.message)
return res.status(400).json({
    error:"Error occured while trying to fetch messages"
})
    }
}



exports.getConversations = async (req, res) => {
    try {
        const userId = req?.user?._id ? req?.user?._id : req.user.id;

        console.log('=== Getting Conversations ===');
        console.log('User ID:', userId);

       
        let conversations = await messageModel
            .find({ user: userId })
            .populate('vendor')
            .lean();

        console.log('Existing conversations count:', conversations.length);
        console.log('Existing conversation vendor IDs:', 
            conversations.map(c => c.vendor?._id?.toString())
        );

    
        const userOrders = await orderModel
            .find({
                user: userId,
                status: { 
                    $in: [
                        'confirmed', 
                        'processing', 
                        'in_transit', 
                        'delivered', 
                        'active', 
                        'paused', 
                        'completed'
                    ] 
                }
            })
            .select('vendor status')
            .lean();

        console.log('Orders found:', userOrders.length);
        console.log('Order details:', userOrders.map(o => ({
            vendor: o.vendor?.toString(),
            status: o.status
        })));

       
        const orderVendorIds = [...new Set(
            userOrders
                .map(order => order.vendor?.toString())
                .filter(Boolean)
        )];

        console.log('Unique vendor IDs from orders:', orderVendorIds);

      
        const existingConversationVendorIds = conversations
            .map(conv => conv.vendor?._id?.toString())
            .filter(Boolean);

       
        const vendorsWithoutConversations = orderVendorIds.filter(
            vendorId => !existingConversationVendorIds.includes(vendorId)
        );

        console.log('Vendors needing conversations:', vendorsWithoutConversations);

       
        if (vendorsWithoutConversations.length > 0) {
            const newConversations = await Promise.all(
                vendorsWithoutConversations.map(async (vendorId) => {
                    try {
                        console.log(`Creating conversation for vendor: ${vendorId}`);
                        
                       
                        const newConversation = await messageModel.create({
                            user: userId,
                            vendor: vendorId,
                            message: 'hi',
                            sendBy: 'user',
                            seenByUser: true,
                            seenByVendor: false,
                            createdAt: new Date()
                        });
                        console.log(`✓ Conversation created with ID: ${newConversation._id}`);
                        
                     
                        const populatedConv = await messageModel
                            .findById(newConversation._id)
                            .populate('vendor')
                            .lean();
                        
                        return populatedConv;
                    } catch (error) {
                        console.error(`✗ Error creating conversation for vendor ${vendorId}:`, error.message);
                        return null;
                    }
                })
            );

        
            const validNewConversations = newConversations.filter(Boolean);
            console.log('New conversations created:', validNewConversations.length);
            
            conversations = [...conversations, ...validNewConversations];
        }

        console.log('=== Final conversation count:', conversations.length, '===\n');

        return res.status(200).json({
            success: true,
            count: conversations.length,
            conversations
        });

    } catch (e) {
        console.error('Error in getConversations:', e);
        return res.status(500).json({
            success: false,
            error: "Error occurred while trying to fetch conversations",
            message: e.message
        });
    }
};

exports.getConversation=async(req,res)=>{
    const {vendor}=req.params;
    try{
        let id=req?.user?._id?req?.user?._id:req.user.id
        let conversation=await messageModel.find({user:id,vendor}).populate('vendor')
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
    let {vendor}=req.params;
    try{
  let id=req?.user?._id?req?.user?._id:req.user.id
  await messageModel.updateMany({vendor,user:id},{$set:{
  seenByUser:true
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