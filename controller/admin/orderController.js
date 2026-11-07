const { STATUS_CODE } = require("../../constants/StatusCode");
const { ADMIN_MESSAGES } = require("../../constants/messages/AdminMessages");
const Order = require("../../models/orderSchema");
const { find } = require("../../models/userSchema");

const getOrder = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments(); // Total number of orders
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find({})
            .sort({ createdAt: -1 })
            .populate("userId")
            .populate("items.productId")
            .skip(skip)
            .limit(limit);

        res.render("order-details-page", {
            orders,
            currentPage: page,
            totalPages,
        });

    } catch (error) {
        console.error(ADMIN_MESSAGES.GET_ORDER_ERROR, error);
        res.redirect("/admin/errorPage");
    }
};

const orderDetails = async (req, res) => {
    try {

        const orderId = req.params.id;

        const order = await Order.findById(orderId)
            .populate("userId") // Include user details
            .populate("items.productId"); // Include product details


        if (!order) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ error: ADMIN_MESSAGES.ORDER_NOT_FOUND });
        }

        res.render("view-orderFull-DetailsPage", {
            order
        })

    } catch (error) {
        console.error(ADMIN_MESSAGES.ERROR_FETCHING_ORDER, error);
        res.redirect("/admin/errorPage");
    }
}

const apdateStatus = async (req, res) => {
    try {
        const { orderId, productId} = req.params;
        const newStatus = req.body.status; 

        // req.params,req.params);
        //  newStatus,newStatus)
        
        // Update the order's status
        const updatedOrder = await Order.findOneAndUpdate(
            {
                _id: orderId,
                "items._id": productId,
            },
            {
                $set: { "items.$.status": newStatus }, 
            },
            { new: true } 
        );

        //updatedOrder,updatedOrder);
        
        if (!updatedOrder) {
            return res.status(STATUS_CODE.NOT_FOUND).send(ADMIN_MESSAGES.ORDER_NOT_FOUND_2);
        }

        res.redirect(`/admin/orders/${orderId}`);
    } catch (error) {
        console.error(ADMIN_MESSAGES.ERROR_UPDATING_ORDER_STATUS, error);
        res.redirect("/admin/errorPage");
    }
};

module.exports = {
    getOrder,
    orderDetails,
    apdateStatus
}