const mongoose=require('mongoose')

// let connection=mongoose.connect('mongodb://127.0.0.1/rent')
const connection=mongoose.connect(`mongodb+srv://user:user@cluster0.pfn059x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`)

module.exports=connection;