const cartModel = require('../models/cart')
const mongoose = require('mongoose')

module.exports.addItemsToCart = async (req, res) => {
    let { applianceId, comboItem } = req.body;
    console.log("appliance id is");
    console.log("Plug type:", comboItem?.plugType);
    console.log("Appliance ID:", applianceId);
   
    if (!applianceId) {
        return res.status(400).json({
            error: "applianceId is required"
        });
    }

    if (!mongoose.Types.ObjectId.isValid(applianceId)) {
        return res.status(400).json({
            error: "Invalid applianceId format"
        });
    }

    try {
   
        const updateData = {
            $addToSet: { 
                "items": applianceId
            }
        };

       
        if (comboItem && comboItem.plugType) {
            updateData.$addToSet["comboItem"] = {
                plugType: comboItem.plugType,
                plugDescription: comboItem.plugDescription || ''
            };
        }

        const updatedCart = await cartModel.findOneAndUpdate(
            { user: req.user._id }, 
            updateData, 
            { 
                new: true, 
                upsert: true, 
                setDefaultsOnInsert: true 
            }
        ).populate({
            path: 'items',
            select: 'name monthly_price photo key_features combo stock_status'
        }); 

        return res.status(200).json({
            message: "Product added to cart successfully",
            cart: updatedCart
        });

    } catch (e) {
        console.log("Error:", e.message);
        return res.status(500).json({
            error: "Facing issue while storing item to cart please try again",
            details: e.message
        });
    }
}


module.exports.getCartItems=async(req,res)=>{
    try {
        
     let cartItems=await cartModel.findOne({user:req.user._id},{items:1}).populate('items')
     return res.status(200).json({
        cartItems
     })

    } catch (e) {
        console.log(e.message);
        return res.status(500).json({
            error: "Facing issue while fetching items from cart please try again",
            details: e.message
        });
    }
}

module.exports.removeFromCart = async (req, res) => {
    let { applianceId } = req.body;
    console.log(applianceId)
    

    if (!applianceId) {
        return res.status(400).json({
            error: "applianceId is required"
        });
    }



    try {
 
        console.log(req.user._id)
        const updatedCart = await cartModel.findOneAndUpdate(
            { user: req.user._id }, 
            { 
                $pull: { 
                    items: applianceId  
                } 
            },
            { 
                new: true, 
            }
        ).populate('items');

       
        if (!updatedCart) {
            return res.status(404).json({
                error: "Cart not found for this user"
            });
        }

        return res.status(200).json({
            message: "Item removed from cart successfully",
            cart: updatedCart
        });

    } catch (e) {
        console.log(e.message);
        return res.status(500).json({
            error: "Facing issue while deleting items from cart please try again",
            details: e.message
        });
    }
}