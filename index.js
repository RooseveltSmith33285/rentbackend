const express=require('express')
const app=express();
const cors=require('cors')
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
require('dotenv').config();
app.use(cors())
app.use(express.json())
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

app.listen(process.env.PORT,()=>{
    console.log(`Listening to port ${process.env.PORT}`)
})

