const express = require('express');
const app = express();
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
const orderCron=require('./utils/order')
require('dotenv').config();
app.use(cors())

app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeConnectWebhook
);

app.use(express.json())
// Socket.io middleware for authentication

scheduleBoostExpiryCheck();
// Store online users
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

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins their room
  socket.on('join', ({ userId, userType }) => {
    console.log(`${userType} ${userId} joined`);
    socket.join(userId);
    socket.userId = userId;
    socket.userType = userType;
    
    onlineUsers.set(userId, {
      socketId: socket.id,
      userType: userType
    });
    
    // Notify others that user is online
    socket.broadcast.emit('userOnline', {
      userId: userId,
      userType: userType,
      isOnline: true
    });

    // If a renter joined, send updated count to all vendors
    if (userType === 'user') {
      const count = getActiveRentersCount();
      io.emit('activeRentersCount', count);
    }
  });

  // Handle new message - ONLY for real-time delivery

  socket.on('getActiveRenters', () => {
    const count = getActiveRentersCount();
    socket.emit('activeRentersCount', count);
    console.log('Sent active renters count:', count);
    console.log('Current online users:', Array.from(onlineUsers.entries()));
  });
  // Handle new message - ONLY for real-time delivery
socket.on('sendMessage', async (data) => {
  try {
    const { conversationId, senderId, receiverId, message, sendBy, timestamp, tempId, image, isNewConversation, vendor, user } = data;
    
    console.log('New message received via socket:', data);
    
    // Check if receiver is online
    const receiverOnline = onlineUsers.has(receiverId);
    
    // If receiver is online, update the message read status in database
    if (receiverOnline && tempId) {
      const Message = require('./models/messages');
      
      try {
        // Update the message that was just saved via API
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
    
    // Just emit to receiver for real-time delivery
    // Message is already saved via API call
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
      isNewConversation: isNewConversation, // ADD THIS
      vendor: vendor, // ADD THIS
      user: user // ADD THIS
    });

    // Confirm to sender with read status
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

  // socket.on('sendMessage', async (data) => {
  //   try {
  //     const { conversationId, senderId, receiverId, message, sendBy, timestamp, tempId } = data;
      
  //     console.log('New message received via socket:', data);
      
  //     // Check if receiver is online
  //     const receiverOnline = onlineUsers.has(receiverId);
      
  //     // Just emit to receiver for real-time delivery
  //     // Message is already saved via API call
  //     io.to(receiverId).emit('newMessage', {
  //       id: tempId, // Use the tempId from API response
  //       senderId: senderId,
  //       receiverId: receiverId,
  //       message: message,
  //       sendBy: sendBy,
  //       timestamp: timestamp,
  //       read: receiverOnline,
  //       conversationId: conversationId
  //     });

  //     // Confirm to sender with read status
  //     socket.emit('messageSent', {
  //       tempId: tempId,
  //       read: receiverOnline,
  //       success: true
  //     });

  //     console.log('Message emitted to receiver');
  //   } catch (error) {
  //     console.error('Error emitting message:', error);
  //     socket.emit('error', { 
  //       message: 'Failed to emit message',
  //       error: error.message 
  //     });
  //   }
  // });

  // Handle messages seen
  socket.on('messagesSeen', async (data) => {
    try {
      const { conversationId, userId, vendorId, seenBy } = data;
      
      console.log('Messages seen:', data);
      
      const Message = require('./models/messages'); // Adjust path
      
      // Update messages in database
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
        
        // Notify vendor
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
        
        // Notify user
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

  // Handle typing indicator
  socket.on('typing', (data) => {
    const { conversationId, receiverId, isTyping, typerType } = data;
    
    console.log('Typing event:', data);
    
    // Emit to receiver only
    io.to(receiverId).emit('userTyping', {
      conversationId: conversationId,
      isTyping: isTyping,
      typerType: typerType
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      
      // Notify others that user is offline
      socket.broadcast.emit('userOffline', {
        userId: socket.userId,
        userType: socket.userType,
        isOnline: false
      });
    }
  });

  // Error handling
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Make io accessible to routes if needed
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
  