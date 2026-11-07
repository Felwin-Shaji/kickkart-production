const { STATUS_CODE } = require("../../constants/StatusCode");
const { ADMIN_MESSAGES } = require("../../constants/messages/AdminMessages");
const Coupon = require("../../models/couponSchema");
const ITEMS_PER_PAGE = 5;

const getCouponsPage = async (req, res) => {
    try {
        const currentPage = parseInt(req.query.page) || 1;

        const totalCoupons = await Coupon.countDocuments();

        const totalPages = Math.ceil(totalCoupons / ITEMS_PER_PAGE);

        const coupons = await Coupon.find()
            .sort({ createdAt: -1 })
            .skip((currentPage - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE);

        res.render("coupen", {
            coupons,
            currentPage,
            totalPages
        });

    } catch (error) {
        console.error(error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send(ADMIN_MESSAGES.SOMETHING_WENT_WRONG);
    }
};

const createCoupon = async (req, res) => {
    try {
        const { code, discountPercentage, minPurchaseAmount, maxPurchaseAmount, startDate, endDate, quantity } = req.body;


        if (!code || !discountPercentage || !minPurchaseAmount || !maxPurchaseAmount || !startDate || !endDate || !quantity) {
            return res.status(STATUS_CODE.BAD_REQUEST).render("error", { message: ADMIN_MESSAGES.ALL_FIELDS_ARE_REQUIRED });
        }

        if (quantity <= 0) {
            return res.status(STATUS_CODE.BAD_REQUEST).render("error", { message: ADMIN_MESSAGES.QUANTITY_MUST_BE_GREATER_THAN_0 });
        }


        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
            return res.status(STATUS_CODE.BAD_REQUEST).render("error", { message: ADMIN_MESSAGES.COUPON_CODE_ALREADY_EXISTS });
        }

        const newCoupon = new Coupon({
            code,
            discountPercentage,
            minPurchaseAmount,
            maxPurchaseAmount,
            startDate,
            endDate,
            quantity,
        });
        await newCoupon.save();
        res.redirect("/admin/coupons");
    } catch (error) {
        console.error(ADMIN_MESSAGES.ERROR_CREATING_COUPON, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).render("error", { message: ADMIN_MESSAGES.FAILED_TO_CREATE_COUPON });
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        await Coupon.findByIdAndDelete(couponId);
        res.redirect("/admin/coupons");
    } catch (error) {
        console.error(ADMIN_MESSAGES.ERROR_DELETING_COUPON, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).render("error", { message: ADMIN_MESSAGES.FAILED_TO_DELETE_COUPON });
    }
};

const updateCoupon = async (req, res) => {
    try {
        const {
            code,
            discountPercentage,
            minPurchaseAmount,
            maxPurchaseAmount,
            startDate,
            endDate,
            quantity
        } = req.body;

        const couponId = req.params.id;

        // Check whether coupon exists
        const coupon = await Coupon.findById(couponId);

        if (!coupon) {
            return res.status(STATUS_CODE.NOT_FOUND).send(ADMIN_MESSAGES.COUPON_NOT_FOUND);
        }

        // Validate purchase amounts
        if (Number(minPurchaseAmount) > Number(maxPurchaseAmount)) {
            return res.status(STATUS_CODE.BAD_REQUEST).send(ADMIN_MESSAGES.MINIMUM_AMOUNT_CANNOT_EXCEED_MAXIMUM_AMOUNT);
        }

        // Update coupon
        await Coupon.findByIdAndUpdate(
            couponId,
            {
                code: code.trim().toUpperCase(),
                discountPercentage,
                minPurchaseAmount,
                maxPurchaseAmount,
                startDate,
                endDate,
                quantity
            },
            { runValidators: true }
        );

        res.redirect("/admin/coupons");

    } catch (error) {
        console.error(ADMIN_MESSAGES.ERROR_UPDATING_COUPON, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send(ADMIN_MESSAGES.SOMETHING_WENT_WRONG);
    }
};

module.exports = {
    getCouponsPage,
    createCoupon,
    deleteCoupon,
    updateCoupon
};
