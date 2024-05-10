const { Transaction } = require('sequelize')
const sequelize = require('../db/db')
const Order = require('../models/order')
const OrderItem = require('../models/orderItems')
const Product = require('../models/product')
const Cart = require('../models/cart')
const User = require('../models/user')
const CartItems = require('../models/cartItems')
const Image = require('../models/image')
const Spells = require('../models/spells')
const { createSession } = require('../utils/payment')
const stripe = require('stripe')(process.env.STRIPE_SK)
const {QueryTypes} = require('sequelize')

Order.belongsTo(User,{foreignKey: 'userId'})
Order.hasMany(OrderItem,{foreignKey: 'orderId'})
OrderItem.belongsTo(Order,{foreignKey:'orderId'})
OrderItem.belongsTo(Product,{foreignKey: 'productId'})
CartItems.belongsTo(Spells, {foreignKey: 'spellId'})
OrderItem.hasOne(Spells, {foreignKey: 'spellId'})
Spells.hasMany(OrderItem, {foreignKey: 'spellId'})

exports.addOrder = async(req,res) => {
    const t = await sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    })
    try {
        const {userId} = req.body
        const cart = await Cart.findOne({
            where: {userId},
            transaction:t
        })
        if(!cart){
            return res.status(404).json("cart not found")
        }
        const cartItems = await sequelize.query(`
            SELECT 
                "ct"."itemId",
                "ct"."cartId",
                "ct"."quantity",
                "products"."productId",
                "products"."name" AS productName,
                "products"."description" AS productDescription,
                "products"."quantity" AS productQuantity,
                "products"."price" AS productPrice,
                "spells"."spellId"
            FROM 
                "cartitems" AS "ct"
            LEFT JOIN 
                "products" AS "products" ON "ct"."productId" = "products"."productId"
            LEFT JOIN 
                "spells" AS "spells" ON "ct"."spellId" = "spells"."spellId"
            WHERE 
                "ct"."cartId" = :cartId
        `, {
            replacements: { cartId: cart.cartId },
            type: sequelize.QueryTypes.SELECT,
            nest: true,
            transaction: t
            });
        console.log(cartItems);

        const order = await Order.create({userId}, {transaction:t})

        let lineItems=[]

        for(const item of cartItems){
            console.log("Product quantity:",item.productquantity,"\nCart quantity:",item.quantity);
            console.log("hello");
            const product = await Product.findByPk(item.productId,{
                lock: t.LOCK.UPDATE
            })

            if(!product || item.productquantity < item.quantity){
                // if(item.product.quantity == null) continue
                return res.status(400).json("insufficient quantity")
            }

            await Product.update(
                {quantity: item.productquantity - item.quantity},
                {where: {productId: item.productId}, transaction:t}
            )

            console.log("spell: ", item.spellId);
 
            await OrderItem.create({
                orderId: order.orderId,
                productId: item.productId,
                quantity: item.quantity,
                price: item.productprice,
                spellId: item.spellId
            }, {transaction: t})

            lineItems.push({
                quantity: item.quantity,
                price_data:{
                    currency: "inr",
                    product_data:{
                        name: product.name
                    },
                    tax_behavior: "inclusive",
                    unit_amount_decimal: product.price * 100
                }
            })
        }

        const {url,id} = await createSession(lineItems,order.orderId)

        await Order.update({
            stripePaymentId: id
        },{where:{orderId: order.orderId},transaction:t})

        await Cart.destroy({where:{userId}, transaction:t})
        await t.commit()
        return res.status(200).json({url, orderId:order.orderId, message: "order placed"});
    } catch (error) {
        console.error(error);
        return res.status(500).json("Internal Server Error")
    }
}

exports.getAllOrdersForAUser = async(req,res)=> {
    try {
        const {userId} = req.params

        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 6;
        const offset = (page - 1) * pageSize;

        const orders = await Order.findAndCountAll({
            where:{
                userId,
                payment_status: 'complete'
            },
            include:[
                {
                    model: OrderItem,
                    attributes:['productId','quantity','price'],
                    include:[
                        {
                            model: Product,
                            attributes: ['name', 'description'],
                            include: [
                                {
                                    model: Image,
                                    attributes: ['imageURL']
                                }
                            ]
                        },
                        {
                            model: Spells,
                            attributes:['name']
                        }
                    ]
                }
            ],
            attributes:['orderId','amount','totalAmount','shippingAmount','stripePaymentId'],
            limit: pageSize,
            offset: offset,
        })
        
        if(orders.count == 0){
            return res.status(400).json("no orders found")
        }

        const totalPages = Math.ceil(orders.count / pageSize);


        const response = {
            orders: orders.rows,
            pagination: {
                page: page,
                pageSize: pageSize,
                totalProducts: orders.count,
                totalPages: totalPages,
            },
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error(error);
        return res.status(500).json("Internal Server Error")
    }
}

exports.success = async(req,res) => {
    try {
        const {orderid} = req.query 
        const order = await Order.findByPk(orderid)

        if(!order) return res.status(400).json("order not found")

        const stripeId = String(order.stripePaymentId)

        const session = await stripe.checkout.sessions.retrieve(stripeId)
        
        await Order.update({
            amount: session?.amount_subtotal/100,
            shippingAmount: session?.shipping_cost.amount_total/100,
            totalAmount: session?.amount_total/100,
            payment_status: session?.status
        },{where:{orderId: orderid}})

        return res.status(200).json("succesful payment")
    } catch (error) {
        console.error(error);
        return res.status(500).json("Internal Server Error")
    }
}

exports.getOrderDetails = async(req,res) => {
    try {
        const {id} = req.params 

        const order = await Order.findOne({
            where:{orderId: id},
            include:[
                {
                    model: OrderItem,
                    attributes: ['quantity', 'price'],
                    include:[
                        {
                            model:Product,
                            attributes:['name','description'],
                            include:[
                                {
                                    model: Image,
                                    attributes: ['imageURL']
                                }
                            ]
                        },
                        {
                            model: Spells,
                            attributes:['name']
                        }
                    ]
                }
            ],
            attributes:['orderId']
        })

        return res.status(200).json(order)
    } catch (error) {
        console.error(error);
        return res.status(500).json("Internal Server Error")
    }
}

exports.getAllOrdersForAdmin = async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;
  
      const countQuery = `
        SELECT COUNT(DISTINCT "orders"."orderId") AS total
        FROM "orders"
        JOIN "orderitems" ON "orders"."orderId" = "orderitems"."orderId"
        WHERE "orders"."payment_status" = 'complete'
      `;
  
      const [countResult] = await sequelize.query(countQuery);
      const totalRows = countResult[0].total;
  
      const response = await sequelize.query(
        `
        SELECT
          "orders"."orderId",
          "orders"."totalAmount",
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'quantity', "orderitems"."quantity",
              'price', "orderitems"."price",
              'product', JSON_BUILD_OBJECT(
                'name', "orderitems->product"."name"
              ),
              'spell', JSON_BUILD_OBJECT(
                'name', "orderitems->spell"."name"
              )
            )
          ) AS "orderitems",
          JSON_BUILD_OBJECT(
            'first_name', "user"."first_name",
            'last_name', "user"."last_name",
            'email', "user"."email"
          ) AS "user"
        FROM "orders"
        JOIN "orderitems" ON "orders"."orderId" = "orderitems"."orderId"
        LEFT OUTER JOIN "products" AS "orderitems->product" ON "orderitems"."productId" = "orderitems->product"."productId"
        LEFT OUTER JOIN "spells" AS "orderitems->spell" ON "orderitems"."spellId" = "orderitems->spell"."spellId"
        JOIN "users" AS "user" ON "orders"."userId" = "user"."userId"
        WHERE "orders"."payment_status" = 'complete'
        GROUP BY "orders"."orderId", "orders"."totalAmount", "user"."first_name", "user"."last_name", "user"."email"
        ORDER BY "orders"."createdAt" DESC
        LIMIT :limit
        OFFSET :offset;
        `,
        {
          replacements: { limit, offset },
          nest: true,
          type: QueryTypes.SELECT,
        }
      );
  
      const pagination = {
        page: parseInt(page),
        pageSize: parseInt(limit),
        totalProducts: totalRows,
        totalPages: Math.ceil(totalRows / limit),
      };
  
      return res.status(200).json({ orders: response, pagination });
    } catch (error) {
      console.error(error);
      return res.status(500).json('Internal Server Error');
    }
};

exports.test = async(req,res) => {
    try {
        const {userId} = req.body
        const cart = await Cart.findOne({
            where: {userId},
        })
        if(!cart){
            return res.status(404).json("cart not found")
        }

        const cartItems = await sequelize.query(`
            SELECT 
                "ct"."itemId",
                "ct"."cartId",
                "ct"."quantity",
                "products"."productId",
                "products"."name" AS productName,
                "products"."description" AS productDescription,
                "products"."quantity" AS productQuantity,
                "products"."price" AS productPrice,
                "spells"."spellId"
            FROM 
                "cartitems" AS "ct"
            LEFT JOIN 
                "products" AS "products" ON "ct"."productId" = "products"."productId"
            LEFT JOIN 
                "spells" AS "spells" ON "ct"."spellId" = "spells"."spellId"
            WHERE 
                "ct"."cartId" = :cartId
        `, {
            replacements: { cartId: cart.cartId },
            type: sequelize.QueryTypes.SELECT,
            nest: true
            });

            const order = await Order.create({userId})

            let lineItems = []

            for(const item of cartItems){
                console.log("Product quantity:",item.productquantity,"\nCart quantity:",item.quantity);
                console.log("hello");
                const product = await Product.findByPk(item.productId)
    
                if(!product || item.productquantity < item.quantity){
                    // if(item.product.quantity == null) continue
                    return res.status(400).json("insufficient quantity")
                }
    
                await Product.update(
                    {quantity: item.productquantity - item.quantity},
                    {where: {productId: item.productId},}
                )
    
                console.log("spell: ", item.spellId);
     
                await OrderItem.create({
                    orderId: order.orderId,
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.productprice,
                    spellId: item.spellId
                })

                lineItems.push({
                    quantity: item.quantity,
                    price_data:{
                        currency: "inr",
                        product_data:{
                            name: product.name
                        },
                        tax_behavior: "inclusive",
                        unit_amount_decimal: product.price * 100
                    }
                })
            }

            return res.status(200).json(lineItems)
    } catch (error) {
        console.error(error);
        return res.status(500).json("Internal Server Error")
    }
}