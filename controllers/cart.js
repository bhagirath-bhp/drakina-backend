const Cart = require('../models/cart')
const CartItems = require('../models/cartItems')
const User = require('../models/user')
const Product = require('../models/product')
const Image = require('../models/image')
const Spell = require('../models/spells')
const { Sequelize, QueryTypes } = require('sequelize')
const sequelize = require('../db/db')

User.hasOne(Cart,{foreignKey: 'userId', onDelete: 'CASCADE', onUpdate:'CASCADE'})
Cart.belongsTo(User,{foreignKey: 'userId'})
CartItems.belongsTo(Product,{foreignKey: 'productId'})
Cart.hasMany(CartItems,{foreignKey: 'cartId'})
// Spell.hasMany(CartItems, {foreignKey: 'spellId'})
CartItems.belongsTo(Spell, {foreignKey: 'spellId'})
Product.hasMany(Image,{foreignKey: 'productId'})
Image.belongsTo(Product,{foreignKey:'productId',onDelete: 'CASCADE',onUpdate: 'CASCADE'})
  
exports.addToCart = async (req, res) => {
    try {
        const { userId, productId, quantity, spellId } = req.body;

        console.log("spell: ", spellId);

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

exports.getCart = async (req, res) => {
    try {
        const { id } = req.params;

        // Raw SQL query to fetch cart data including associated cart items, products, and spells
        const query = `
            SELECT 
                c."cartId",
                c."userId",
                ci."cartId" AS "cartitems.cartId",
                ci."quantity" AS "cartitems.quantity",
                p."productId" AS "cartitems.product.productId",
                p."name" AS "cartitems.product.name",
                p."price" AS "cartitems.product.price",
                i."imageURL" AS "cartitems.product.images.imageURL",
                s."spellId" AS "cartitems.spell.spellId",
                s."name" AS "cartitems.spell.name"
            FROM 
                "carts" c
            LEFT JOIN 
                "cartitems" ci ON c."cartId" = ci."cartId"
            LEFT JOIN 
                "products" p ON ci."productId" = p."productId"
            LEFT JOIN 
                "images" i ON p."productId" = i."productId"
            LEFT JOIN 
                "spells" s ON ci."spellId" = s."spellId"
            WHERE 
                c."userId" = :userId;
        `;

        const cartItems = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements: { userId: id },
            raw: true
        });

        if (!cartItems || cartItems.length === 0) {
            return res.status(404).json({ error: 'Cart not found for the user' });
        }

        // Group cart items by cartId
        const groupedCartItems = cartItems.reduce((acc, item) => {
            const existingCartItem = acc.find((cartItem) => cartItem.cartId === item['cartitems.cartId']);
            if (existingCartItem) {
                existingCartItem.cartitems.push({
                    cartId: item['cartId'],
                    product: {
                        productId: item['cartitems.product.productId'],
                        name: item['cartitems.product.name'],
                        price: item['cartitems.product.price'],
                        images: [{ imageURL: item['cartitems.product.images.imageURL'] }]
                    },
                    quantity: item['cartitems.quantity'],
                    spell: {
                        spellId: item['cartitems.spell.spellId'],
                        name: item['cartitems.spell.name']
                    }
                });
            } else {
                acc.push({
                    cartId: item.cartId,
                    userId: item.userId,
                    cartitems: [
                        {
                            cartId: item['cartId'],
                            product: {
                                productId: item['cartitems.product.productId'],
                                name: item['cartitems.product.name'],
                                price: item['cartitems.product.price'],
                                images: [{ imageURL: item['cartitems.product.images.imageURL'] }]
                            },
                            quantity: item['cartitems.quantity'],
                            spell: {
                                spellId: item['cartitems.spell.spellId'],
                                name: item['cartitems.spell.name']
                            }
                        }
                    ]
                });
            }
            return acc;
        }, []);

        return res.status(200).json(groupedCartItems);

    } catch (error) {
        console.error(error);
        return res.status(500).json("Internal Server Error");
    }
};


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