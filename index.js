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

app.listen(process.env.PORT,()=>{
    console.log(`Listening to port ${process.env.PORT}`)
})

