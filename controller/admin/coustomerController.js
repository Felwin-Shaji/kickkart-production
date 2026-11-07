const { STATUS_CODE } = require("../../constants/StatusCode");
const { ADMIN_MESSAGES } = require("../../constants/messages/AdminMessages");
const User = require('../../models/userSchema');

const customerInfo = async (req, res) => {
    try {
        let search = "";
        if (req.query.search) {
            search = req.query.search;
        }

        let page = 1;
        if (req.query.page) {
            page = parseInt(req.query.page);
        }

        const limit = 7;


        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();


        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ],
        });


        const totalPages = Math.ceil(count / limit);


        res.render('adminCustomers', {
            userData,
            currentPage: page,
            totalPages,
            search
        });
    } catch (error) {
        console.error(error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send(ADMIN_MESSAGES.INTERNAL_SERVER_ERROR);
        res.redirect("/admin/errorPage");
    }
};

const customerBlock = async (req, res) => {
    try {
        const id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });

        if (req.session.user) {
            req.session.user=null
        }
 
        res.redirect("/admin/users");

    } catch (error) {
        console.log(ADMIN_MESSAGES.CUSTOMER_BLOCK_ERROR_LOG)
        res.redirect("/admin/errorPage");
    }
}

const customerUnblock = async (req, res) => {
    try {

        let id = req.query.id;

        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });

        res.redirect("/admin/users");

    } catch (error) {
        console.log(ADMIN_MESSAGES.CUSTOMER_UNBLOCK_ERROR_LOG)
        res.redirect("/admin/errorPage");
    }
}
module.exports = { customerInfo, customerBlock, customerUnblock }
