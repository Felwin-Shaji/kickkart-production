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
        res.status(500).send("Something went wrong");
    }
};

const createCoupon = async (req, res) => {
    try {
        const { code, discountPercentage, minPurchaseAmount, maxPurchaseAmount, startDate, endDate, quantity } = req.body;


        if (!code || !discountPercentage || !minPurchaseAmount || !maxPurchaseAmount || !startDate || !endDate || !quantity) {
            return res.status(400).render("error", { message: "All fields are required" });
        }

        if (quantity <= 0) {
            return res.status(400).render("error", { message: "Quantity must be greater than 0" });
        }


        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
            return res.status(400).render("error", { message: "Coupon code already exists" });
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
        console.error("Error creating coupon:", error);
        res.status(500).render("error", { message: "Failed to create coupon" });
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        await Coupon.findByIdAndDelete(couponId);
        res.redirect("/admin/coupons");
    } catch (error) {
        console.error("Error deleting coupon:", error);
        res.status(500).render("error", { message: "Failed to delete coupon" });
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
            return res.status(404).send("Coupon not found");
        }

        // Validate purchase amounts
        if (Number(minPurchaseAmount) > Number(maxPurchaseAmount)) {
            return res.status(400).send("Minimum amount cannot exceed maximum amount");
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
        console.error("Error updating coupon:", error);
        res.status(500).send("Something went wrong");
    }
};

module.exports = {
    getCouponsPage,
    createCoupon,
    deleteCoupon,
    updateCoupon
};
