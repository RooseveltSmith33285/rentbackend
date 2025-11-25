const express = require('express');
const app = express();


const fs=require('fs')
const nodemailer=require('nodemailer')


const SupportTicket  = require('./models/ticket');
const {SupportMessage}=require('./models/support')

const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});
const cors=require('cors')
const {scheduleBoostExpiryCheck}=require('./utils/cronjob')
const connection=require('./connection/connection')
const authRoutes=require('./routes/auth')
const paymentRoutes=require('./routes/payment')
const productRoutes=require('./routes/products')
const orderRoutes=require('./routes/order')

const cartRoutes=require('./routes/cart')
const dashboardRoutes=require('./routes/dashboard')
const adminRoutes=require('./routes/admin')
const vendorRoutes=require('./routes/vendor')
const vendorAuthRoutes=require('./routes/vendorauth')
const communityRoutes=require('./routes/community')
const userlistenings=require('./routes/userlistening')
const requestRoutes=require('./routes/request')
const messagesRoutes=require('./routes/messages')
const {handleStripeConnectWebhook}=require('./controller/payment')
const orderCron=require('./utils/order');
const adminModel = require('./models/admin');
require('dotenv').config();
app.use(cors())

app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeConnectWebhook
);

app.use(express.json())


scheduleBoostExpiryCheck();

const onlineUsers = new Map();

const getActiveRentersCount = () => {
  let count = 0;
  for (let [userId, userData] of onlineUsers.entries()) {
    if (userData.userType === 'user') {
      count++;
    }
  }
  return count;
};


io.on('connection', (socket) => {
  console.log('User connected:', socket.id);


  socket.on('join', ({ userId, userType }) => {
    console.log(`${userType} ${userId} joined`);
    socket.join(userId);
    socket.userId = userId;
    socket.userType = userType;
    
    onlineUsers.set(userId, {
      socketId: socket.id,
      userType: userType
    });
    
    
    socket.broadcast.emit('userOnline', {
      userId: userId,
      userType: userType,
      isOnline: true
    });

   
    if (userType === 'user') {
      const count = getActiveRentersCount();
      io.emit('activeRentersCount', count);
    }
  });


  socket.on('getActiveRenters', () => {
    const count = getActiveRentersCount();
    socket.emit('activeRentersCount', count);
    console.log('Sent active renters count:', count);
    console.log('Current online users:', Array.from(onlineUsers.entries()));
  });
 
socket.on('sendMessage', async (data) => {
  try {
    const { conversationId, senderId, receiverId, message, sendBy, timestamp, tempId, image, isNewConversation, vendor, user } = data;
    
    console.log('New message received via socket:', data);
    
   
    const receiverOnline = onlineUsers.has(receiverId);
    
    
    if (receiverOnline && tempId) {
      const Message = require('./models/messages');
      
      try {
        
        if (sendBy === 'user') {
          await Message.findByIdAndUpdate(tempId, { seenByVendor: true });
        } else if (sendBy === 'vendor') {
          await Message.findByIdAndUpdate(tempId, { seenByUser: true });
        }
        console.log('Message marked as read because receiver is online');
      } catch (dbError) {
        console.error('Error updating message read status:', dbError);
      }
    }
    
  
    io.to(receiverId).emit('newMessage', {
      id: tempId,
      senderId: senderId,
      receiverId: receiverId,
      message: message,
      image: image,
      sendBy: sendBy,
      timestamp: timestamp,
      read: receiverOnline,
      conversationId: conversationId,
      isNewConversation: isNewConversation, 
      vendor: vendor,
      user: user 
    });

  
    socket.emit('messageSent', {
      tempId: tempId,
      read: receiverOnline,
      success: true
    });

    console.log('Message emitted to receiver');
  } catch (error) {
    console.error('Error emitting message:', error);
    socket.emit('error', { 
      message: 'Failed to emit message',
      error: error.message 
    });
  }
});



// ADD THIS IN YOUR SOCKET LISTENERS
socket.on('ticketClosed', (data) => {
  try {
    const { ticketId, userId, userType, closedAt } = data;
    
    console.log('Ticket closed by user:', data);
    
    // Broadcast to admin room
    io.to('admin-room').emit('ticketClosed', {
      ticketId: ticketId,
      userId: userId,
      userType: userType,
      closedAt: closedAt
    });
    
    console.log('Ticket closed notification sent to admin room');
  } catch (error) {
    console.error('Error handling ticket closed event:', error);
  }
});

// Add these new socket listeners in your io.on('connection') block
// ADD THIS NEW LISTENER
socket.on('newTicketCreated', async (data) => {
  try {
    const { ticketId, message, sendBy, userId, timestamp, messageId, userType } = data;
    
    console.log('New ticket created via socket:', data);
    
    // Fetch the complete ticket with populated user data
    const SupportTicket = require('./models/ticket'); // Adjust path as needed
    
    const populatedTicket = await SupportTicket.findById(ticketId)
      .populate('userId', 'name email avatar');
    
    // Emit to admin room with complete ticket data
    io.to('admin-room').emit('newTicket', {
      ticket: populatedTicket,
      message: {
        _id: messageId,
        message: message,
        sentBy: sendBy,
        createdAt: timestamp,
        seenByAdmin: false
      },
      userType: userType
    });
    
    console.log('✅ Emitted newTicket event to admin-room');
  } catch (error) {
    console.error('Error handling newTicketCreated:', error);
  }
});
socket.on('sendSupportMessage', async (data) => {
  try {
    const { ticketId, message, sendBy, userId, timestamp, messageId, userType } = data;
    
    console.log('Support message sent via socket:', data);
    
    // Emit to admin room
    io.to('admin-room').emit('newSupportMessage', {
      ticketId: ticketId,
      message: {
        _id: messageId,
        message: message,
        sentBy: sendBy,
        createdAt: timestamp,
        seenByAdmin: false
      },
      userType: userType
    });
    
    console.log('Support message emitted to admin room');
  } catch (error) {
    console.error('Error emitting support message:', error);
  }
});


socket.on('supportMessagesRead', async (data) => {
  try {
    const { ticketId, userId, userType } = data;
    
    console.log('Support messages read by user:', data);
    
    // Emit to admin room to update read status
    io.to('admin-room').emit('supportMessageRead', {
      ticketId: ticketId,
      userId: userId,
      userType: userType,
      timestamp: new Date()
    });
    
    console.log('Support message read confirmation sent to admin');
  } catch (error) {
    console.error('Error emitting support read confirmation:', error);
  }
});




socket.on('joinAdminRoom', () => {
  socket.join('admin-room');
  console.log('Admin joined admin-room:', socket.id);
});

  socket.on('messagesSeen', async (data) => {
    try {
      const { conversationId, userId, vendorId, seenBy } = data;
      
      console.log('Messages seen:', data);
      
      const Message = require('./models/messages'); 
      
     
      if (seenBy === 'user') {
        await Message.updateMany(
          { 
            user: userId, 
            vendor: vendorId, 
            sendBy: 'vendor', 
            seenByUser: false 
          },
          { seenByUser: true }
        );
        
     
        io.to(vendorId).emit('messagesRead', {
          conversationId: userId,
          seenBy: 'user',
          timestamp: new Date()
        });
        
        console.log('User marked vendor messages as read');
      } else if (seenBy === 'vendor') {
        await Message.updateMany(
          { 
            user: userId, 
            vendor: vendorId, 
            sendBy: 'user', 
            seenByVendor: false 
          },
          { seenByVendor: true }
        );
        
        
        io.to(userId).emit('messagesRead', {
          conversationId: vendorId,
          seenBy: 'vendor',
          timestamp: new Date()
        });
        
        console.log('Vendor marked user messages as read');
      }
    } catch (error) {
      console.error('Error marking messages as seen:', error);
      socket.emit('error', { 
        message: 'Failed to update read status',
        error: error.message 
      });
    }
  });


  socket.on('typing', (data) => {
    const { conversationId, receiverId, isTyping, typerType } = data;
    
    console.log('Typing event:', data);
    
    
    io.to(receiverId).emit('userTyping', {
      conversationId: conversationId,
      isTyping: isTyping,
      typerType: typerType
    });
  });


  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      

      socket.broadcast.emit('userOffline', {
        userId: socket.userId,
        userType: socket.userType,
        isOnline: false
      });
    }
  });


  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});


app.set('io', io);

connection
app.use(authRoutes)
app.use(paymentRoutes)
app.use(productRoutes)
app.use(cartRoutes)
app.use(orderRoutes)
app.use(dashboardRoutes)
app.use(adminRoutes)
app.use(vendorRoutes)
app.use(vendorAuthRoutes)
app.use(communityRoutes)
app.use(userlistenings)
app.use(requestRoutes)
app.use(messagesRoutes)



app.post('/adminsupportsendmessage',async(req, res) => {
  let { ticketId, message, adminId} = req.body;
  
  try {
    const ticket = await SupportTicket.findById(ticketId)
    .populate('userId');
  
    let adminFound=await adminModel.findOne({email:adminId})
    adminId=adminFound._id
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
    
    // Emit socket event to user
    if (typeof io !== 'undefined' && io) {
      io.to(ticket.userId.toString()).emit('newSupportMessage', {
        id: newMessage._id,
        messageId: newMessage._id,
        ticketId: ticketId,
        message: message,
        sendBy: 'admin',
        timestamp: newMessage.createdAt
      });
    }
    

     // Send email notification to user
     if (ticket.userId && ticket.userId.email) {
      const user = ticket.userId;
      const userType = ticket.userType || 'user'; // 'user' for renter, 'vendor' for vendor
      const userName = user.name || user.businessName || user.email;
      
      const mailOptions = {
        from: 'orders@enrichifydata.com',
        to: user.email,
        subject: '💬 Support Team Response - RentSimple',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <div style="background-color: #0d6efd; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">💬 Support Response</h1>
              <p style="color: #cfe2ff; margin-top: 10px; font-size: 16px;">Our support team has responded to your ticket</p>
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
              <h3 style="color: #2c3e50; border-bottom: 2px solid #0d6efd; padding-bottom: 10px; margin-top: 0;">
                Support Team Message
              </h3>
              
              <p style="color: #495057; font-size: 16px; line-height: 1.6; margin-top: 20px;">
                Hello <strong>${userName}</strong>,
              </p>
              
              <p style="color: #495057; font-size: 16px; line-height: 1.6;">
                Our support team has responded to your ticket. Please review the message below and feel free to reply if you need further assistance.
              </p>
  
              <!-- Ticket Information -->
              <h4 style="color: #2c3e50; margin-top: 30px; margin-bottom: 15px;">Ticket Information:</h4>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <tr>
                  <td style="padding: 12px; background-color: #f8f9fa; width: 40%; font-weight: 600; color: #2c3e50;">Ticket ID</td>
                  <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057; font-family: monospace;">#${ticket._id}</td>
                </tr>
                ${ticket.subject ? `
                <tr>
                  <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">Subject</td>
                  <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057;">${ticket.subject}</td>
                </tr>
                ` : ''}
                ${ticket.category ? `
                <tr>
                  <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">Category</td>
                  <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057; text-transform: capitalize;">${ticket.category}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">Status</td>
                  <td style="padding: 12px; border: 1px solid #dee2e6;">
                    <span style="background-color: #ffc107; color: #000; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">${ticket.status}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px; background-color: #f8f9fa; font-weight: 600; color: #2c3e50;">User Type</td>
                  <td style="padding: 12px; border: 1px solid #dee2e6; color: #495057; text-transform: capitalize;">${userType === 'vendor' ? 'Vendor' : 'Renter'}</td>
                </tr>
              </table>
  
              <!-- Support Message -->
              <div style="margin-top: 30px; padding: 25px; background-color: #e7f3ff; border-left: 4px solid #0d6efd; border-radius: 4px;">
                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                  <div style="background-color: #0d6efd; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; margin-right: 15px;">
                    🛟
                  </div>
                  <div>
                    <h4 style="margin: 0; color: #084298; font-size: 16px;">RentSimple Support Team</h4>
                    <p style="margin: 0; color: #6c757d; font-size: 12px;">Admin Response</p>
                  </div>
                </div>
                <div style="padding: 15px; background-color: #ffffff; border-radius: 8px; border: 1px solid #b6d4fe;">
                  <p style="margin: 0; color: #495057; font-size: 14px; line-height: 1.8; white-space: pre-wrap;">${message}</p>
                </div>
              </div>
  
              <!-- Response Reminder -->
              <div style="margin-top: 30px; padding: 20px; background-color: #d1ecf1; border-left: 4px solid #17a2b8; border-radius: 4px;">
                <h4 style="margin: 0 0 10px 0; color: #0c5460; font-size: 16px;">💡 Need More Help?</h4>
                <p style="margin: 0; color: #0c5460; font-size: 14px; line-height: 1.6;">
                  If you have additional questions or need further clarification, simply reply to this ticket through your dashboard. Our team is here to help you!
                </p>
              </div>
  
              <!-- Call to Action Button -->
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || 'https://rentsimpledeals.com'}/${userType === 'vendor' ? 'vendor' : 'dashboard'}/support/tickets/${ticket._id}" 
                   style="display: inline-block; background-color: #0d6efd; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  View & Reply to Ticket
                </a>
              </div>
  
              <!-- Quick Tips -->
              <div style="margin-top: 30px; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <h4 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">⚡ Quick Tips</h4>
                <ul style="margin: 10px 0; padding-left: 20px; color: #856404; font-size: 14px; line-height: 1.8;">
                  <li>Reply promptly to get faster resolution</li>
                  <li>Provide any additional details that might help</li>
                  <li>Check your dashboard regularly for updates</li>
                  <li>You can attach screenshots if needed</li>
                </ul>
              </div>
  
              <!-- Response Time -->
              <div style="margin-top: 30px; padding: 20px; background-color: #d4edda; border-left: 4px solid #28a745; border-radius: 4px;">
                <h4 style="margin: 0 0 10px 0; color: #155724; font-size: 16px;">⏰ Our Commitment</h4>
                <p style="margin: 0; color: #155724; font-size: 14px; line-height: 1.6;">
                  <strong>Average Response Time:</strong> Our support team typically responds within 2-4 hours during business hours. For urgent matters, we'll prioritize your ticket accordingly.
                </p>
              </div>
  
              <!-- Support Info -->
              <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
                <h4 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px;">📞 Alternative Contact</h4>
                <p style="margin: 0; color: #495057; font-size: 14px; line-height: 1.6;">
                  For urgent matters, you can also reach us directly through:
                </p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #495057; font-size: 14px; line-height: 1.8;">
                  <li><strong>Email:</strong> support@rentsimple.com</li>
                  <li><strong>Phone:</strong> Available in your dashboard</li>
                </ul>
              </div>
  
              <!-- Ticket ID -->
              <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 4px; text-align: center;">
                <p style="margin: 0; color: #6c757d; font-size: 12px;">
                  Ticket Reference: <strong>#${ticket._id}</strong> • Message ID: <strong>#${newMessage._id}</strong>
                </p>
              </div>
            </div>
  
            <!-- Footer -->
            <div style="background-color: #2c3e50; padding: 20px; text-align: center;">
              <p style="margin: 0; color: #ecf0f1; font-size: 12px;">
                This is an automated notification from RentSimple Support.
              </p>
              <p style="margin: 10px 0 0 0; color: #95a5a6; font-size: 11px;">
                © 2025 RentSimple. All rights reserved.
              </p>
              <p style="margin: 10px 0 0 0; color: #95a5a6; font-size: 11px;">
                Please do not reply directly to this email. Use your dashboard to respond to support tickets.
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

      // Send email (don't await to avoid blocking the response)
      transporter.sendMail(mailOptions).catch(err => {
        console.error('Error sending support message email notification:', err);
      });
    }
    res.json({ success: true, messageId: newMessage._id });
    
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: error.message });
  }
})


app.patch('/closeTicket/:ticketId',async(req, res) => {
  const { ticketId } = req.params;
  
  try {
    const ticket = await SupportTicket.findOne({
      _id: ticketId
    });
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    ticket.status = 'closed';
    await ticket.save();
    
    // EMIT SOCKET EVENT TO ADMIN ROOM
    if (typeof io !== 'undefined' && io) {
      io.to('admin-room').emit('ticketClosed', {
        ticketId: ticketId,
        userId: ticket.userId,
        closedAt: new Date()
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: error.message });
  }
})


app.get('/cancelsub',async(req,res)=>{
  try{
    const stripe = require('stripe')(process.env.STRIPE_LIVE);
    const subscription = await stripe.subscriptions.cancel(
      'sub_1SD8BS5uH62846vETzknXRKM'
    );
   
    console.log(subscription)
  }catch(e){
console.log(e.message)
  }
})

app.get('/connect-billcom', async (req, res) => {
    try {
      const loginResponse = await fetch('https://gateway.stage.bill.com/connect/v3/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          
        },
        body: JSON.stringify({
          username: 'Dawar Dawar',
          password: '6AYdXnaVr&2K7jA=@',
          devKey:"01MSDYSSYQKZDONT3681"
        })
      });
      
      const loginData = await loginResponse.json();
      console.log('Login response:', loginData);
      
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });   


  orderCron

  server.listen(process.env.PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${process.env.PORT}`);
  });
  