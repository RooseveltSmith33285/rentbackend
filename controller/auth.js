const userModel = require('../models/user');
const jwt = require('jsonwebtoken'); // Use 'jsonwebtoken' instead of 'json-web-token'

module.exports.register = async (req, res) => {
    let { ...data } = req.body;
    
    try {
        // Check if user already exists
        let alreadyExists = await userModel.findOne({ email: data.email });
        if (alreadyExists) {
            return res.status(400).json({
                error: "User already exists"
            });
        }

        // Create new user
        let user = await userModel.create(data);
        
        // Generate JWT token
        let userToken = jwt.sign({ _id: user._id, email: user.email }, process.env.JWT_KEY, {
            expiresIn: '7d' // Optional: set expiration
        });

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
        // Find user by email
        let userFound = await userModel.findOne({ email });
        if (!userFound) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        // Check password (assuming you have a method to compare passwords)
        // This assumes your user model has a comparePassword method or similar
        let passwordMatch = await userModel.findOne({password:password});
        // Alternative if you're storing plain text (NOT RECOMMENDED):
        // let passwordMatch = userFound.password === password;
        
        if (!passwordMatch) {
            return res.status(401).json({
                error: "Invalid Password"
            });
        }

        // Generate JWT token
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