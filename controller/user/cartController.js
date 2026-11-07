const { STATUS_CODE } = require("../../constants/StatusCode");
const { COMMON_MESSAGES } = require("../../constants/messages/CommonMessages");
const mongoose = require("mongoose");
const env = require('dotenv').config;
const Razorpay = require('razorpay');
const crypto = require('crypto');
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");


const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET,
});

const Cart = require("../../models/cartSchema")
const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")
const Coupen = require("../../models/couponSchema");


const getCart = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/login");
        }

        const cartData = await Cart.findOne({ user: userId })
            .populate("items.product")
            .lean();

        if (!cartData || cartData.items.length === 0) {
            return res.render("shop/cart", { cart: { items: [], totalPrice: 0 } });
        }

        let hasInsufficientStock = false;
        let errorMessage = null;

        cartData.items = cartData.items.map((item) => {
            const variant = item.product.variants.find((variant) => variant.size === item.size);
            const stockQuantity = variant ? variant.quantity : 0;

            if (item.quantity > stockQuantity || stockQuantity === 0) {
                hasInsufficientStock = true;
            }

            return {
                ...item,
                stockQuantity,
            };
        });

        if (hasInsufficientStock) {
            errorMessage = "One or more products in your cart have insufficient stock. Please remove or reduce the quantity.";
        }

        // Cart Data:, cartData);
        res.render("shop/cart", {
            cart: cartData,
            user: userId,
            errorMessage,
        });
    } catch (error) {
        console.error(COMMON_MESSAGES.GET_CART_ERROR, error);
        res.redirect("/pageNotFound");
    }
};

const cart = async (req, res) => {
    try {
        const { productId, selectedSize, quantity } = req.body;
        const userId = req.session.user;

        let quantities = parseInt(quantity, 10)

        if (!userId) {
            return res.status(STATUS_CODE.UNAUTHORIZED).json({ success: false, message: COMMON_MESSAGES.PLEASE_LOG_IN_TO_ADD_ITEMS_TO_YOUR_CART });
        };
        
        // Fetch product details
        const productItems = await Product.findOne({ _id: productId, isBlocked: false });

        if (!productItems) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ success: false, message: COMMON_MESSAGES.PRODUCT_NOT_FOUND_OR_BLOCKED });
        }

        // productItems :, productItems);

        // Check if cart exists
        let cart = await Cart.findOne({ user: userId });

        if (!cart) {
            // Create a new cart if it doesn't exist
            cart = new Cart({
                user: userId,
                items: [{
                    product: productId,
                    quantity: quantities,
                    size: selectedSize,
                    price: productItems.salePrice * quantities,
                    regularPrice: productItems.regularPrice * quantities
                }],
                totalPrice: productItems.salePrice * quantities,
                totalregularPrice: productItems.regularPrice * quantities
            });
        } else {
            // Check if the product with the selected size already exists in the cart
            const existingProductIndex = cart.items.findIndex(item => item.product.toString() === productId && item.size === selectedSize);

            if (existingProductIndex >= 0) {
                // If the product with the selected size exists, update the quantity and price
                const existingProduct = cart.items[existingProductIndex];
                existingProduct.price = existingProduct.quantity * productItems.salePrice;
                existingProduct.regularPrice = existingProduct.quantity * productItems.regularPrice;
            } else {
                // If it's a new product or size, add it to the cart as a new item
                cart.items.push({
                    product: productId,
                    quantity: quantities,
                    size: selectedSize,
                    price: productItems.salePrice * quantities,
                    regularPrice: productItems.regularPrice * quantities
                });
            }

            // Update total price
            cart.totalPrice = cart.items.reduce((total, item) => total + item.price, 0);
            cart.totalregularPrice = cart.items.reduce((total, item) => total + item.regularPrice, 0);
        }

        // Save cart changes
        await cart.save();

        // Cart updated:, cart);

        return res.status(STATUS_CODE.OK).json({
            success: true,
            redirectUrl: "/cart",
            message: COMMON_MESSAGES.ITEM_ADDED_TO_YOUR_CART_SUCCESSFULLY,
        });
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_ADDING_TO_CART, error);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.AN_ERROR_OCCURRED_WHILE_ADDING_THE_ITEM_TO_THE_CART });
    }
};

const cartQuantity = async (req, res) => {
    try {
        const { productId, selectedSize, quantity } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(STATUS_CODE.UNAUTHORIZED).json({ success: false, message: COMMON_MESSAGES.PLEASE_LOG_IN_TO_UPDATE_CART });
        }

        const product = await Product.findOne({ _id: productId, isBlocked: false });

        const productData = product.variants.reduce(item => item.size == selectedSize)

        if (!product) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ success: false, message: COMMON_MESSAGES.PRODUCT_NOT_FOUND_OR_BLOCKED });
        }

        const cart = await Cart.findOne({ user: userId });

        if (!cart) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ success: false, message: COMMON_MESSAGES.CART_NOT_FOUND });
        }

        const existingProductIndex = cart.items.findIndex(item => item.product.toString() === productId && item.size === selectedSize);

        if (existingProductIndex >= 0) {

            const existingProduct = cart.items[existingProductIndex];

            // if (quantity > productData.quantity) {
            //     return res.status(STATUS_CODE.BAD_REQUEST).json({
            //         success: false,
            //         message: COMMON_MESSAGES.ONLY_ITEMS_AVAILABLE_IN_STOCK.replace("{quantity}", productData.quantity),
            //     });
            // }

            existingProduct.quantity = quantity;
            existingProduct.price = quantity * product.salePrice;
            existingProduct.regularPrice = quantity * product.regularPrice;
        } else {
            return res.status(STATUS_CODE.NOT_FOUND).json({ success: false, message: COMMON_MESSAGES.PRODUCT_WITH_THE_SELECTED_SIZE_NOT_FOUND_IN_THE_CART });
        }



        cart.totalPrice = cart.items.reduce((total, item) => total + item.price, 0);
        cart.totalregularPrice = cart.items.reduce((total, item) => total + item.regularPrice, 0);

        await cart.save();

        return res.status(STATUS_CODE.OK).json({
            success: true,
            message: COMMON_MESSAGES.CART_QUANTITY_UPDATED_SUCCESSFULLY,
            cart: {
                items: cart.items,
                totalPrice: cart.totalPrice,
                totalregularPrice: cart.totalregularPrice
            },
        });


    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_UPDATING_CART_QUANTITY, error);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.AN_ERROR_OCCURRED_WHILE_UPDATING_THE_CART });
    }
};

const remove = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.params.id;
        const size = String(req.params.size);

        if (!userId || !productId || !size) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: COMMON_MESSAGES.INVALID_REQUEST_PARAMETERS,
            });
        }

        // Removing product with size:, size);

        // Update the cart by pulling the specific product from the items array
        const updatedCart = await Cart.findOneAndUpdate(
            { user: userId },
            { $pull: { items: { product: productId, size: size } } },
            { new: true } // Return the updated cart
        );

        if (updatedCart) {
            // Recalculate the total prices
            updatedCart.totalPrice = updatedCart.items.reduce((total, item) => total + item.price, 0);
            updatedCart.totalregularPrice = updatedCart.items.reduce((total, item) => total + item.regularPrice, 0);

            // If cart is empty, consider removing it
            if (updatedCart.items.length === 0) {
                await Cart.findByIdAndDelete(updatedCart._id);
                return res.status(STATUS_CODE.OK).json({
                    success: true,
                    message: COMMON_MESSAGES.ITEM_REMOVED_AND_CART_CLEARED,
                });
            }

            // Save the updated cart
            await updatedCart.save();

            return res.status(STATUS_CODE.OK).json({
                success: true,
                message: COMMON_MESSAGES.ITEM_REMOVED_FROM_CART_SUCCESSFULLY,
                cart: updatedCart,
            });
        } else {
            return res.status(STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: COMMON_MESSAGES.CART_NOT_FOUND_OR_ITEM_NOT_IN_CART,
            });
        }
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_REMOVING_ITEM_FROM_CART, error);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: COMMON_MESSAGES.AN_ERROR_OCCURRED_WHILE_REMOVING_THE_ITEM,
        });
    }
};

const applyCoupen = async (req, res) => {
    try {
        const { couponNumber, PriceBrfCoupen } = req.body;

        // Validate required fields
        if (!couponNumber || PriceBrfCoupen === undefined) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.COUPON_CODE_AND_PRICE_ARE_REQUIRED });
        }

        const userId = req.session.user;
        if (!userId) {
            return res.status(STATUS_CODE.UNAUTHORIZED).json({ message: COMMON_MESSAGES.USER_SESSION_EXPIRED_PLEASE_LOG_IN_AGAIN });
        }

        const coupon = await Coupen.findOne({ code: couponNumber });
        if (!coupon) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: COMMON_MESSAGES.INVALID_COUPON_CODE });
        }

        if (!coupon.isActive) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.THIS_COUPON_IS_NO_LONGER_ACTIVE });
        }

        const currentDate = new Date();
        if (currentDate < coupon.startDate || currentDate > coupon.endDate) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.THIS_COUPON_IS_NOT_VALID_AT_THE_MOMENT });
        }

        if (coupon.userId.includes(userId)) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.YOU_HAVE_ALREADY_USED_THIS_COUPON });
        }

        if (PriceBrfCoupen < coupon.minPurchaseAmount) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                message: COMMON_MESSAGES.MINIMUM_PURCHASE_AMOUNT_SHOULD_BE_GREATER_THAN.replace("{amount}", coupon.minPurchaseAmount),
            });
        }

        if (PriceBrfCoupen >= coupon.maxPurchaseAmount) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                message: COMMON_MESSAGES.MAXIMUM_PURCHASE_AMOUNT_SHOULD_BE_LESSER_THAN.replace("{amount}", coupon.maxPurchaseAmount),
            });
        }

        // Successful application
        res.status(STATUS_CODE.OK).json({
            message: COMMON_MESSAGES.COUPON_APPLIED_SUCCESSFULLY,
            discount: coupon.discountPercentage,
            couponNumber
        });
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_APPLYING_COUPON, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ message: COMMON_MESSAGES.SERVER_ERROR_PLEASE_TRY_AGAIN_LATER });
    }
};

const checkout = async (req, res) => {
    try {
        const userId = req.session.user;
        // User ID:, userId);

        if (!userId) {
            return res.redirect("/login");
        }

        const userAddress = await Address.findOne({ userId: userId });
        const addresses = userAddress?.address || [];

        const coupons = await Coupen.find({})


        // userAddress, userAddress);

        const cart = await Cart.findOne({ user: userId }).populate("items.product")

        //qqqqqqqqqqqqqqqqqqqqqqqqqqqqqcartcartcartcartcart,cart)


        if (!cart || cart.items.length === 0) {
            return res.redirect("/cart");
        }



        res.render("shop/checkout", {
            userId,
            cart,
            totalPrice: cart.totalPrice,
            totalregularPrice: cart.totalregularPrice,
            userAddress: addresses,
            coupons
        });

    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_RENDERING_CHECKOUT_PAGE, error.message);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send(COMMON_MESSAGES.AN_ERROR_OCCURRED_WHILE_LOADING_THE_CHECKOUT_PAGE);
    }
};

const placeOrder = async (req, res) => {
    const userId = req.session.user;
    try {
        const { selectedAddress, paymentMethod, coupenCode, totalAmount, coupenOffer, totalregularPrice } = req.body;
        // req.body, req.body);

        if (totalAmount < 2000) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                message: COMMON_MESSAGES.CASH_ON_DELIVERY_COD_IS_ONLY_AVAILABLE_FOR_ORDERS_ABOVE_2000_PLEASE_SELECT_A_DIFFERENT_PAYMENT_METHOD
            });
        }


        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.YOUR_CART_IS_EMPTY });
        }

        const addressDocument = await Address.findOne({ userId, 'address._id': selectedAddress });
        if (!addressDocument) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.SELECTED_ADDRESS_NOT_FOUND });
        }

        const address = addressDocument.address.find((addr) => addr._id.toString() === selectedAddress);

        const coupen = await Coupen.findOne({ code: coupenCode });
        if (coupen) {
            const today = new Date();

            if (today < coupen.startDate || today > coupen.endDate) {
                return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.COUPON_IS_NOT_VALID_FOR_THIS_DATE });
            }

            if (totalAmount < coupen.minPurchaseAmount) {
                return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.MINIMUM_PURCHASE_AMOUNT.replace("{amount}", coupen.minPurchaseAmount) });
            }

            if (coupen.quantity <= 0) {
                return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.COUPON_IS_NO_LONGER_AVAILABLE });
            }

            if (coupen.userId.includes(userId)) {
                return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.YOU_HAVE_ALREADY_USED_THIS_COUPON });
            }

            coupen.quantity -= 1;
            coupen.userId.push(userId);
            await coupen.save();
        }

        const validPaymentMethods = ["COD", "Online", "Wallet"];
        if (!validPaymentMethods.includes(paymentMethod)) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.INVALID_PAYMENT_METHOD });
        }

        for (const item of cart.items) {
            const product = await Product.findOne(
                { _id: item.product._id, "variants.size": item.size },
                { "variants.$": 1 }
            );

            if (!product || product.variants[0].quantity < item.quantity) {
                throw new Error(
                    `Insufficient stock for product "${item.product.productName}" (size: ${item.size}).`
                );
            }
        }

        const orderData = {
            userId,
            items: cart.items.map((item) => ({
                productId: item.product._id,
                quantity: item.quantity,
                size: item.size,
                price: item.price,
                regularPrice: item.regularPrice
            })),
            shippingAddress: address,
            paymentMethod,
            coupenOffer: coupenOffer,
            totalAmount: totalAmount,
            totalregularPrice: totalregularPrice,
            paymentStatus: "pending"
        };

        const order = await Order.create(orderData);

        const variantData = order.items.map((item) => ({
            quantity: item.quantity,
            size: item.size,
            id: item.productId,
        }));

        const updatePromises = variantData.map((variant) =>
            Product.updateOne(
                { _id: variant.id, "variants.size": variant.size },
                { $inc: { "variants.$.quantity": -variant.quantity } }
            )
        );

        await Promise.all(updatePromises);

        await Cart.findByIdAndDelete(cart._id);

        res.redirect("/order-success");
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_PLACING_ORDER, error);

        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
            message: COMMON_MESSAGES.AN_ERROR_OCCURRED_WHILE_PLACING_YOUR_ORDER_PLEASE_TRY_AGAIN,
            error: error.message,
        });
    }
};

const razorpayCreatOrder = async (req, res) => {
    const userId = req.session.user;
    const { amount, currency, selectedAddress, paymentMethod, coupenCode, coupenOffer, totalregularPrice } = req.body;
    if (!selectedAddress) {
        return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.SELECTED_ADDRESS_NOT_FOUND });
    }
    try {
        const order = await razorpayInstance.orders.create({
            amount: amount * 100, // Convert amount to paise
            currency: currency || "INR",
            receipt: `receipt_${Date.now()}`,
        });

        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.YOUR_CART_IS_EMPTY });
        }

        const addressDocument = await Address.findOne({ userId, 'address._id': selectedAddress });
        if (!addressDocument) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.SELECTED_ADDRESS_NOT_FOUND });
        }

        const address = addressDocument.address.find(
            (addr) => addr._id.toString() === selectedAddress
        );

        const orderData = {
            userId,
            razorpayOrderId: order.id,
            items: cart.items.map((item) => ({
                productId: item.product._id,
                quantity: item.quantity,
                size: item.size,
                price: item.price,
                regularPrice: item.regularPrice
            })),
            shippingAddress: address,
            paymentMethod,
            coupenOffer,
            totalAmount: amount,
            totalregularPrice,
            paymentStatus: "pending",
        };


        const savedOrder = await Order.create(orderData);

        await Cart.findOneAndDelete({ user: userId });

        res.status(STATUS_CODE.OK).json({ success: true, order, savedOrder });
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_CREATING_ORDER, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.UNABLE_TO_CREATE_RAZORPAY_ORDER });
    }
};

const varifyPayment = async (req, res) => {
    // Verify Payment API called...);
    const userId = req.session.user;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Received Data:, req.body);

    if (!razorpay_payment_id || !razorpay_signature) {
        console.log(COMMON_MESSAGES.PAYMENT_FAILED_OR_USER_CANCELED);

        // Update order status as failed & increment retry count
        await Order.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            { $set: { paymentStatus: "failed" } },
            { new: true }
        );

        return res.status(STATUS_CODE.BAD_REQUEST).json({
            success: false,
            message: COMMON_MESSAGES.PAYMENT_NOT_COMPLETED_PLEASE_TRY_AGAIN
        });
    }

    try {
        const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });

        if (!order) {
            console.log(COMMON_MESSAGES.ORDER_NOT_FOUND_FOR_RAZORPAY_ORDER_ID, razorpay_order_id);
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.ORDER_NOT_FOUND_2 });
        }

        const key_secret = process.env.RAZORPAY_SECRET;
        const hmac = crypto.createHmac('sha256', key_secret);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generated_signature = hmac.digest('hex');

        // Generated Signature:, generated_signature);
        // Received Signature:, razorpay_signature);

        let paymentStatus = generated_signature === razorpay_signature ? "completed" : "failed";

        // Updating order payment status to:, paymentStatus);

        const updatedOrder = await Order.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            { $set: { paymentStatus: paymentStatus === "completed" ? "completed" : "failed" } },
            { new: true }
        );


        // Updated Order:, updatedOrder);

        if (paymentStatus === "completed") {
            const variantData = order.items.map((item) => ({
                quantity: item.quantity,
                size: item.size,
                id: item.productId,
            }));

            const updatePromises = variantData.map((variant) =>
                Product.updateOne(
                    { _id: variant.id, "variants.size": variant.size },
                    { $inc: { "variants.$.quantity": -variant.quantity } }
                )
            );

            await Promise.all(updatePromises);
            await Cart.findOneAndDelete({ user: userId });
        } else {
            await Order.findOneAndUpdate(
                { razorpayOrderId: razorpay_order_id },
                // Increment retry count on failure
            );
        }

        res.status(STATUS_CODE.OK).json({
            success: paymentStatus === "completed",
            message: paymentStatus === "completed"
                ? "Payment verified and order placed"
                : "Payment failed, please retry",
            order: updatedOrder,
        });
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_PROCESSING_PAYMENT, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: COMMON_MESSAGES.FAILED_TO_PROCESS_PAYMENT,
            error: error.message,
        });
    }
};

const retryPayment = async (req, res) => {
    const { orderId } = req.body;

    try {
        const order = await Order.findById(orderId);

        if (!order || !["failed", "pending"].includes(order.paymentStatus)) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: COMMON_MESSAGES.INVALID_ORDER_OR_PAYMENT_ALREADY_COMPLETED });
        }

        // Prevent infinite retries


        // Create a new Razorpay order
        const razorpayOrder = await razorpayInstance.orders.create({
            amount: order.totalAmount * 100,
            currency: "INR",
            receipt: `retry_${Date.now()}`
        });

        // Update the existing order with new Razorpay order ID and increment retry count
        order.razorpayOrderId = razorpayOrder.id;
        order.paymentStatus = "failed";
        await order.save();

        res.status(STATUS_CODE.OK).json({ success: true, order: razorpayOrder });
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_RETRYING_PAYMENT, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.FAILED_TO_RETRY_PAYMENT });
    }
};

const handleFailedPayment = async (req, res) => {
    // try {

    //     const { status, message, order_id } = req.body;
    //     req.bodyreq.bodyreq.body,req.body)

    //     if (!order_id) {
    //         return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.MISSING_RAZORPAY_ORDER_ID });
    //     }

    //     // Find the order
    //     const order = await Order.findOne({ _id: order_id });
    //     orderorderorderorderorder,order)
    //     if (!order) {
    //         return res.status(STATUS_CODE.NOT_FOUND).json({ message: COMMON_MESSAGES.ORDER_NOT_FOUND });
    //     }

    //     // Update the payment status to "failed"
    //     order.paymentStatus = "failed";
    //     await order.save();

    //     console.log(`Payment failed for Order ID: ${order._id}`);

    //     return res.status(STATUS_CODE.OK).json({ message: COMMON_MESSAGES.PAYMENT_MARKED_AS_FAILED, order });

    // } catch (error) {
    //     console.error(COMMON_MESSAGES.ERROR_HANDLING_FAILED_PAYMENT, error);
    //     return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR_2 });
    // }
};

const walletOrderPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        const { selectedAddress, paymentMethod, coupenCode, totalAmount, coupenOffer, totalregularPrice } = req.body;
        // req.body, req.body);

        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.YOUR_CART_IS_EMPTY });
        }

        const addressDocument = await Address.findOne({ userId, 'address._id': selectedAddress });
        if (!addressDocument) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.SELECTED_ADDRESS_NOT_FOUND });
        }

        const address = addressDocument.address.find((addr) => addr._id.toString() === selectedAddress);

        const coupen = await Coupen.findOne({ code: coupenCode });
        if (coupen) {
            const today = new Date();

            if (today < coupen.startDate || today > coupen.endDate) {
                return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.COUPON_IS_NOT_VALID_FOR_THIS_DATE });
            }

            if (totalAmount < coupen.minPurchaseAmount) {
                return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.MINIMUM_PURCHASE_AMOUNT.replace("{amount}", coupen.minPurchaseAmount) });
            }

            if (coupen.quantity <= 0) {
                return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.COUPON_IS_NO_LONGER_AVAILABLE });
            }

            if (coupen.userId.includes(userId)) {
                return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.YOU_HAVE_ALREADY_USED_THIS_COUPON });
            }

            coupen.quantity -= 1;
            coupen.userId.push(userId);
            await coupen.save();
        }

        // paymentMethodpaymentMethod, paymentMethod);
        // useruseruseruseruseruseruseruseruseruser)
        if (paymentMethod === "Wallet") {
            // useruseruseruseruseruseruseruseruseruser)
            const user = await User.findById(userId);
            // user, user)
            if (!user) {
                return res.status(STATUS_CODE.NOT_FOUND).json({ message: COMMON_MESSAGES.USER_NOT_FOUND });
            }

            if (user.wallet.balance < totalAmount) {
                return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.INSUFFICIENT_WALLET_BALANCE_PLEASE_USE_ANOTHER_PAYMENT_METHOD });
            }

            // Deduct the amount from the user's wallet
            user.wallet.balance -= totalAmount;
            user.wallet.transactions.push({
                type: "debit",
                amount: totalAmount,
                description: "Order payment",
            });
            await user.save();
        }

        const validPaymentMethods = ["COD", "Online", "Wallet"];
        if (!validPaymentMethods.includes(paymentMethod)) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.INVALID_PAYMENT_METHOD });
        }

        for (const item of cart.items) {
            const product = await Product.findOne(
                { _id: item.product._id, "variants.size": item.size },
                { "variants.$": 1 }
            );

            if (!product || product.variants[0].quantity < item.quantity) {
                throw new Error(
                    `Insufficient stock for product "${item.product.productName}" (size: ${item.size}).`
                );
            }
        }

        const orderData = {
            userId,
            items: cart.items.map((item) => ({
                productId: item.product._id,
                quantity: item.quantity,
                size: item.size,
                price: item.price,
                regularPrice: item.regularPrice
            })),
            shippingAddress: address,
            paymentMethod,
            coupenOffer: coupenOffer,
            totalAmount: totalAmount,
            totalregularPrice: totalregularPrice,
            paymentStatus: "completed"
        };

        const order = await Order.create(orderData);

        const variantData = order.items.map((item) => ({
            quantity: item.quantity,
            size: item.size,
            id: item.productId,
        }));

        const updatePromises = variantData.map((variant) =>
            Product.updateOne(
                { _id: variant.id, "variants.size": variant.size },
                { $inc: { "variants.$.quantity": -variant.quantity } }
            )
        );

        await Promise.all(updatePromises);

        await Cart.findByIdAndDelete(cart._id);

        res.redirect("/order-success");
    } catch (error) {
        console.error(COMMON_MESSAGES.WALLET_ORDER_ERROR, error);

        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
            message: COMMON_MESSAGES.AN_ERROR_OCCURRED_WHILE_PLACING_YOUR_ORDER_PLEASE_TRY_AGAIN,
            error: error.message,
        });
    }
};

const getOrderSuccessPage = async (req, res) => {
    res.render("order/order-complete-page")
}

const getOrderFailedPage = async (req, res) => {
    res.render("order/order-failure-Page")
}

const viewOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;


        const order = await Order.findById(orderId)
            .sort({ createdAt: -1 })
            .populate("items.productId", "productName productImage salePrice")
            .lean();

        if (!order) {
            return res.status(STATUS_CODE.NOT_FOUND).send(COMMON_MESSAGES.ORDER_NOT_FOUND_2);
        }

        // Order Details:, order);

        res.render("order/orderDetailsPage", { order });
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_FETCHING_ORDER_DETAILS, error.message);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send(COMMON_MESSAGES.AN_ERROR_OCCURRED_WHILE_FETCHING_ORDER_DETAILS);
    }
};

// const cancelOrderAllCart = async (req, res) => {
//     try {
//         const orderId = req.params.id;

//         const order = await Order.findById(orderId);
//         if (!order) {
//             return res.status(STATUS_CODE.NOT_FOUND).json({ error: COMMON_MESSAGES.ORDER_NOT_FOUND });
//         }

//         if (order.status === "Cancelled") {
//             return res.status(STATUS_CODE.BAD_REQUEST).json({ error: COMMON_MESSAGES.ORDER_IS_ALREADY_CANCELLED });
//         }

//         await Order.findByIdAndUpdate(orderId, { status: "Cancelled" }, { new: true });

//         for (const item of order.items) {
//             const productId = item.productId;
//             const size = item.size;
//             const quantityToAdd = item.quantity;

//             await Product.updateOne(
//                 { _id: productId, "variants.size": size },
//                 { $inc: { "variants.$.quantity": quantityToAdd } }
//             );
//         }

//         res.status(STATUS_CODE.OK).json(COMMON_MESSAGES.ORDER_CANCELLED_SUCCESSFULLY_AND_INVENTORY_UPDATED);
//     } catch (error) {
//         console.error(COMMON_MESSAGES.CANCEL_ORDER_ERROR, error);
//         res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ error: COMMON_MESSAGES.INTERNAL_SERVER_ERROR_2 });
//     }
// };

const cancelSingleItem = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderId = req.params.orderId;
        const productId = req.params.productId;

        const orderedItem = await Order.findOne(
            { _id: orderId, userId: userId, "items.productId": productId },
            { "items.$": 1, paymentMethod: 1, coupenOffer: 1, totalAmount: 1, totalregularPrice: 1, isCouponAdjusted: 1 }
        ).lean();

        if (!orderedItem || !orderedItem.items || orderedItem.items.length === 0) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: COMMON_MESSAGES.ORDER_OR_PRODUCT_NOT_FOUND });
        }

        const item = orderedItem.items[0];
        const { paymentMethod, coupenOffer, totalAmount, totalregularPrice, isCouponAdjusted } = orderedItem;

        if (coupenOffer > 0 && item.price < coupenOffer) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                message: COMMON_MESSAGES.ITEM_CANNOT_BE_CANCELLED_AS_ITS_PRICE_IS_LESS_THAN_THE_COUPON_OFFER
            });
        }

        // Update order status
        const result = await Order.updateOne(
            { _id: orderId, "items.productId": productId },
            { $set: { "items.$.status": "Cancelled" } }
        );

        if (result.modifiedCount === 0) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.FAILED_TO_CANCEL_THE_ITEM });
        }

        // **Update product quantity back to inventory**
        await Product.updateOne(
            { _id: productId, "variants.size": item.size },
            { $inc: { "variants.$.quantity": item.quantity } }
        );

        // **Process refund if payment was online or wallet**
        if (paymentMethod === "Online" || paymentMethod === "Wallet") {
            let refundAmount = item.price;

            if (!isCouponAdjusted && coupenOffer > 0) {
                refundAmount -= coupenOffer;
                await Order.updateOne({ _id: orderId }, { $set: { isCouponAdjusted: true } });
            }

            await User.updateOne(
                { _id: userId },
                {
                    $inc: { "wallet.balance": refundAmount },
                    $push: {
                        "wallet.transactions": {
                            type: "credit",
                            amount: refundAmount,
                            description: `Refund for cancelled item (Order ID: ${orderId})`,
                            date: new Date()
                        }
                    }
                }
            );

            return res.status(STATUS_CODE.OK).json({ message: COMMON_MESSAGES.ITEM_CANCELLED_AND_REFUND_PROCESSED_SUCCESSFULLY });
        }

        if (paymentMethod === "COD") {
            return res.status(STATUS_CODE.OK).json({ message: COMMON_MESSAGES.ITEM_CANCELLED_SUCCESSFULLY });
        }

    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_CANCELLING_ITEM, error.message);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ message: COMMON_MESSAGES.AN_ERROR_OCCURRED_WHILE_CANCELLING_THE_ITEM });
    }
};


const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId).populate("items.productId");

        if (!order) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: COMMON_MESSAGES.ORDER_NOT_FOUND });
        }

        const doc = new PDFDocument({ margin: 10 });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="invoice_${orderId}.pdf"`);

        doc.pipe(res);

        const primaryColor = "#007BFF";
        const textColor = "#343A40";
        const statusColors = {
            Pending: "#FFC107",
            Shipped: "#17A2B8",
            Delivered: "#28A745",
            Cancelled: "#DC3545",
            Returned: "#6C757D",
        };

        doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);
        doc.fillColor("#FFFFFF").fontSize(24).font("Helvetica-Bold").text("INVOICE", 50, 30);

        doc.fillColor(textColor).fontSize(12).moveDown(2);
        doc.text(`Order ID: ${order._id}`, 10).moveDown(0.2);
        doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`).moveDown(0.2);
        doc.text(`Payment Method: ${order.paymentMethod}`).moveDown();

        const billingAddress = order.shippingAddress || {};
        doc.fillColor("#28A745").fontSize(14).text("Billing Address:", { underline: true }).moveDown(0.5);
        doc.fillColor(textColor).fontSize(12);
        doc.text(`Name: ${billingAddress.name || "N/A"}`);
        doc.text(`City: ${billingAddress.city || "N/A"}`);
        doc.text(`State: ${billingAddress.state || "N/A"}`);
        doc.text(`Pincode: ${billingAddress.pincode || "N/A"}`);
        doc.text(`Phone: ${billingAddress.phone || "N/A"}`).moveDown();

        doc.fillColor("#28A745").fontSize(14).text("Order Items:", { underline: true }).moveDown(0.5);

        const colX = { no: 20, name: 70, price: 230, qty: 340, total: 400, status: 500 };
        const rowHeight = 45;

        doc.fillColor("#FFFFFF").rect(20, doc.y - 5, 570, rowHeight).fill(primaryColor);
        doc.fillColor("#FFFFFF").fontSize(12).font("Helvetica-Bold");

        const headerY = doc.y + 5;
        doc.text("No", colX.no, headerY, { width: 30, align: "center" });
        doc.text("Product Name", colX.name, headerY, { width: 160, align: "left" });
        doc.text("Price", colX.price, headerY, { width: 50, align: "right" });
        doc.text("Qty", colX.qty, headerY, { width: 30, align: "center" });
        doc.text("Total", colX.total, headerY, { width: 70, align: "right" });
        doc.text("Status", colX.status, headerY, { width: 70, align: "center" });

        doc.moveDown(1);
        doc.fillColor(textColor).font("Helvetica");
        let positionY = doc.y;

        let totalRefundAmount = 0;

        order.items.forEach((item, index) => {
            const bgColor = index % 2 === 0 ? "#F8F9FA" : "#E9ECEF";
            doc.rect(20, positionY - 5, 570, 20).fill(bgColor);
            doc.fillColor(textColor).fontSize(12);

            doc.text(`${index + 1}`, colX.no, positionY, { width: 30, align: "center" });
            doc.text(item.productId?.productName || "Unknown Product", colX.name, positionY);
            doc.text(`Rs ${item.productId?.salePrice}`, colX.price, positionY, { width: 60, align: "right" });
            doc.text(`${item.quantity}`, colX.qty, positionY, { width: 30, align: "center" });
            doc.text(`Rs ${item.price}`, colX.total, positionY, { width: 70, align: "right" });

            const statusColor = statusColors[item.status] || "#000000";
            doc.fillColor(statusColor).text(item.status, colX.status, positionY, { width: 70, align: "center" });
            doc.fillColor(textColor);

            if (["Cancelled", "Returned"].includes(item.status)) {
                totalRefundAmount += item.price;
            }

            positionY += 20;
        });



        if (order.coupenOffer > 0) {
            totalRefundAmount = Math.max(0, totalRefundAmount - order.coupenOffer);
        }

        doc.moveDown(1);
        doc.fillColor("#6C757D").lineWidth(1).moveTo(20, doc.y).lineTo(590, doc.y).stroke();
        doc.moveDown(1.5);
        doc.fillColor("#000000").fontSize(14).font("Helvetica-Bold");

        doc.text(`Subtotal: Rs ${order.totalregularPrice}`, 20, doc.y);
        doc.text(`Discount: Rs ${order.coupenOffer || 0}`, 20, doc.y);
        doc.text(`Grand Total: Rs ${order.totalAmount}`, 20, doc.y);

        if (totalRefundAmount > 0) {
            doc.text(`Total Refund: Rs ${totalRefundAmount}`, 20, doc.y);
        }

        doc.fillColor(primaryColor).fontSize(10).font("Helvetica-Oblique").text("Thank you for shopping with us!", { align: "center" });

        doc.end();
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_GENERATING_INVOICE, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR });
    }
};

const returnOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderId = req.params.orderId;
        const productId = req.params.productId;

        const orderedItem = await Order.findOne(
            { _id: orderId, userId: userId, "items.productId": productId },
            { "items.$": 1, paymentMethod: 1, coupenOffer: 1, totalAmount: 1, totalregularPrice: 1, isCouponAdjusted: 1 }
        ).lean();

        if (!orderedItem || !orderedItem.items || orderedItem.items.length === 0) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: COMMON_MESSAGES.ORDER_OR_PRODUCT_NOT_FOUND });
        }

        const item = orderedItem.items[0];
        const { paymentMethod, coupenOffer, isCouponAdjusted } = orderedItem;

        if (item.status !== "Delivered") {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.ONLY_DELIVERED_ITEMS_CAN_BE_RETURNED });
        }

        const result = await Order.updateOne(
            { _id: orderId, "items.productId": productId },
            { $set: { "items.$.status": "Returned" } }
        );

        if (result.modifiedCount === 0) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.FAILED_TO_RETURN_THE_ITEM });
        }

        await Product.updateOne(
            { _id: productId, "variants.size": item.size },
            { $inc: { "variants.$.quantity": item.quantity } }
        );


        if (paymentMethod === "Online" || paymentMethod === "Wallet") {
            let refundAmount = item.price;

            if (!isCouponAdjusted && coupenOffer > 0) {
                refundAmount -= coupenOffer;
                await Order.updateOne({ _id: orderId }, { $set: { isCouponAdjusted: true } });
            }

            await User.updateOne(
                { _id: userId },
                {
                    $inc: { "wallet.balance": refundAmount },
                    $push: {
                        "wallet.transactions": {
                            type: "credit",
                            amount: refundAmount,
                            description: `Refund for returned item (Order ID: ${orderId})`,
                            date: new Date(),
                        },
                    },
                }
            );

            return res.status(STATUS_CODE.OK).json({ message: COMMON_MESSAGES.ITEM_RETURNED_AND_REFUND_PROCESSED_SUCCESSFULLY });
        }

        if (paymentMethod === "COD") {
            return res.status(STATUS_CODE.OK).json({ message: COMMON_MESSAGES.ITEM_RETURNED_SUCCESSFULLY });
        }

    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_RETURNING_ITEM, error.message);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ message: COMMON_MESSAGES.AN_ERROR_OCCURRED_WHILE_PROCESSING_THE_RETURN });
    }
};

const razorpayCreatWallet = async (req, res) => {
    try {
        const { amount } = req.body;

        const options = {
            amount: amount * 100,  // Amount in paise
            currency: 'INR',
            receipt: crypto.randomBytes(10).toString('hex'),
            payment_capture: 1
        };

        razorpayInstance.orders.create(options, (err, order) => {
            if (err) {
                return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.FAILED_TO_CREATE_ORDER });
            }
            res.json({
                success: true,
                order_id: order.id,
                amount: amount,
            });
        });
    } catch (error) {
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.ERROR_CREATING_RAZORPAY_ORDER });
    }
}

const razorpayvarifyWallet = async (req, res) => {
    try {
        const { payment_id, order_id, amount, razorpay_signature } = req.body;

        // amount, amount);

        const data = {
            razorpay_order_id: order_id,
            razorpay_payment_id: payment_id,
        };

        const secret = process.env.RAZORPAY_SECRET;
        const generated_signature = crypto.createHmac('sha256', secret)
            .update(order_id + "|" + payment_id)
            .digest('hex');

        if (generated_signature === razorpay_signature) {
            const userId = req.session.user;
            // userIduserId, userId);

            const user = await User.findById(userId);
            // User fetched from DB:, user);

            if (!user) {
                console.error(COMMON_MESSAGES.USER_NOT_FOUND_FOR_ID, userId);
                return res.status(STATUS_CODE.NOT_FOUND).json({ success: false, message: COMMON_MESSAGES.USER_NOT_FOUND });
            }

            await User.updateOne(
                { _id: userId },
                {
                    $inc: { "wallet.balance": amount },
                    $push: {
                        "wallet.transactions": {
                            type: "credit",
                            amount: amount,
                            description: `Added money via Razorpay )`,
                            date: new Date()
                        }
                    }
                }
            );

            res.json({ success: true, message: COMMON_MESSAGES.MONEY_ADDED_TO_WALLET });
        } else {
            res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: COMMON_MESSAGES.INVALID_PAYMENT_SIGNATURE });
        }
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_VERIFYING_PAYMENT, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.AN_ERROR_OCCURRED_DURING_VERIFICATION });
    }
};

module.exports = {
    getCart,
    cart,
    remove,
    cartQuantity,
    checkout,
    applyCoupen,
    placeOrder,
    getOrderSuccessPage,
    viewOrderDetails,
    cancelSingleItem,
    returnOrder,
    razorpayCreatOrder,
    varifyPayment,
    razorpayCreatWallet,
    razorpayvarifyWallet,
    walletOrderPayment,
    downloadInvoice,
    retryPayment,
    handleFailedPayment,
    getOrderFailedPage
}