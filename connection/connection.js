const mongoose=require('mongoose')

// let connection=mongoose.connect('mongodb://127.0.0.1/rent')
let connection=mongoose.connect('mongodb+srv://developer:developer@cluster0.k1ekxcf.mongodb.net/')
// const connection=mongoose.connect(`mongodb+srv://user:user@cluster0.pfn059x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`)

module.exports=connection;