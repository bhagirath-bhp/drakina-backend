const Cart = require('../models/cart')
const CartItems = require('../models/cartItems')
const User = require('../models/user')
const Product = require('../models/product')
const Image = require('../models/image')
const Spell = require('../models/spells')

User.hasOne(Cart,{foreignKey: 'userId', onDelete: 'CASCADE', onUpdate:'CASCADE'})
Cart.belongsTo(User,{foreignKey: 'userId'})
CartItems.belongsTo(Product,{foreignKey: 'productId'})
Cart.hasMany(CartItems,{foreignKey: 'cartId'})
CartItems.belongsTo(Spell, {foreignKey: "spellId"})
Spell.hasMany(CartItems, {foreignKey: 'spellId'})
Product.hasMany(Image,{foreignKey: 'productId'})
Image.belongsTo(Product,{foreignKey:'productId',onDelete: 'CASCADE',onUpdate: 'CASCADE'})
  
exports.addToCart = async (req, res) => {
    try {
        const { userId, productId, quantity, spellId } = req.body;

        const cart = await Cart.findOne({
            where: {
                userId
            }
        });

        if (!cart) {
            const newCart = await Cart.create({
                userId
            });

            if(spellId){
                const [cartItem] = await CartItems.findOrCreate({
                    where: {
                        cartId: newCart.cartId,
                        productId,
                        spellId
                    },
                    defaults: {
                        quantity: quantity > 1 ? quantity : 1
                    }
                });
                if (!cartItem) {
                    return res.status(500).json("Internal Server Error");
                }
    
                return res.status(200).json("Added to cart");
            }
            else{
                const [cartItem] = await CartItems.findOrCreate({
                    where: {
                        cartId: newCart.cartId,
                        productId,
                    },
                    defaults: {
                        quantity: quantity > 1 ? quantity : 1
                    }
                });
                if (!cartItem) {
                    return res.status(500).json("Internal Server Error");
                }
    
                return res.status(200).json("Added to cart");
            }
        }
        
        if(spellId){
            const [cartItem] = await CartItems.findOrCreate({
                where: {
                    cartId: cart.cartId,
                    productId,
                    spellId
                },
                defaults: {
                    quantity: quantity > 1 ? quantity : 1
                }
            });
    
            if (!cartItem) {
                return res.status(500).json("Internal Server Error");
            }
    
            if (!cartItem._options.isNewRecord) {
                await cartItem.update({
                    quantity: quantity > 1 ? quantity : 1
                });
            }
        }else{
            const [cartItem] = await CartItems.findOrCreate({
                where: {
                    cartId: cart.cartId,
                    productId,
                },
                defaults: {
                    quantity: quantity > 1 ? quantity : 1
                }
            });
    
            if (!cartItem) {
                return res.status(500).json("Internal Server Error");
            }
    
            if (!cartItem._options.isNewRecord) {
                await cartItem.update({
                    quantity: quantity > 1 ? quantity : 1
                });
            }
        }

        return res.status(200).json("Added to cart");

    } catch (error) {
        console.error(error);
        return res.status(500).json("Internal Server Error");
    }
};


exports.getCart = async(req,res) => {
    try {
        const {id} = req.params

        const cart = await Cart.findOne({
            where:{
                userId: id,
            },
            include:[
                {
                    model: CartItems,
                    include: [
                        {
                            model: Product,
                            attributes: ['productId', 'name', 'price'],
                            include: [{
                                model: Image,
                                attributes: ['imageURL']
                            }]
                        },
                        {
                            model: Spell,
                            attributes: ['spellId', 'name']
                        }
                    ],
                    attributes:['cartId','quantity']
                }
            ],
            attributes: ['cartId','userId']
        })

        if (!cart) {
            return res.status(404).json({ error: 'Cart not found for the user' });
        }
      
        return res.status(200).json(cart);

    } catch (error) {
        console.error(error);
        return res.status(500).json("Internal Server Error")
    }
}

exports.reduceQuantity = async(req,res) => {
    try {
        const {cartId,quantity,productId} = req.body 
        const item = await CartItems.findOne({where: {
            cartId,
            productId
        }})
        item.quantity = quantity
        await item.save()
        return res.status(200).json("changed the quantity")
    } catch (error) {
        console.error(error);
        return res.status(500).json("Internal Server Error")
    }
}

exports.removeFromCart = async(req,res) => {
    try {
        const {cartId,productId} = req.body 
        await CartItems.destroy({
            where:{
                cartId,
                productId
            }
        })

        const cnt = await CartItems.count({
            where:{
                "cartId": cartId
            }
        })

        if(cnt == 0) {
            await Cart.destroy({
                where:{
                    "cartId": cartId
                }
            })
        }
        return res.status(200).json("item removed from cart")
    } catch (error) {
        console.error(error);
        return res.status(500).json("Internal Server Error")
    }
}