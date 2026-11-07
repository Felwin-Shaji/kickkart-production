const { STATUS_CODE } = require("../../constants/StatusCode");
const { COMMON_MESSAGES } = require("../../constants/messages/CommonMessages");
const Wishlist = require("../../models/wishlistSchema")
const User = require("../../models/userSchema")

const addToWishlist = async (req, res) => {
    try {
        const productId = req.body.productId; // Correct variable name
        const userId = req.session.user; // Assumes `userId` is stored in session

        // userId, userId);
        // productId, productId);

        // Find the wishlist by userId
        let wishlist = await Wishlist.findOne({ userId });

        const product = {
            productId: productId, // Corrected key name
            addedAt: Date.now(),
        };

        if (!wishlist) {
            wishlist = new Wishlist({
                userId: userId,
                products: [product],
            });
        } else {
            const existingProductIndex = wishlist.products.findIndex(
                (item) => item.productId.toString() === productId
            );

            if (existingProductIndex === -1) {
                wishlist.products.push(product);
            } else {
                return res.status(STATUS_CODE.OK).json({ message: COMMON_MESSAGES.PRODUCT_ALREADY_IN_WISHLIST });
            }
        }

        await wishlist.save();

        res.status(STATUS_CODE.OK).json({ message: COMMON_MESSAGES.PRODUCT_ADDED_TO_WISHLIST_SUCCESSFULLY });
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_ADDING_TO_WISHLIST, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ error: COMMON_MESSAGES.AN_ERROR_OCCURRED_WHILE_ADDING_TO_WISHLIST });
    }
};


const getWishlist = async (req, res) => {
    try {
        // Fetching wishlist...);

        const user = req.session.user; // Assumes `userId` is stored in session
        // User:, user);

        // Query Wishlist by userId
        let wishlist = await Wishlist.findOne({ userId: user }).populate("products.productId");

        if (!wishlist) {
            wishlist = {
                user: req.session.user,
                products: [],
            };
        }

        // Calculate the sum of quantities in the variants
        wishlist.products.forEach(product => {
            if (product.productId && product.productId.variants) {
                product.totalQuantity = product.productId.variants.reduce((sum, variant) => sum + (variant.quantity || 0), 0);
            } else {
                product.totalQuantity = 0;
            }
        });

        // Wishlist:, JSON.stringify(wishlist, null, 2));

        return res.render('shop/wishlist', { wishlist });
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_FETCHING_WISHLIST, error.message);
        return res.redirect('/500');
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const { productId } = req.body; // Extract productId from the request body
        // Product ID to remove:, productId);

        // Use $pull to remove the product from the products array
        const result = await Wishlist.updateOne(
            { userId: req.session.user }, // Match the wishlist by userId
            { $pull: { products: { productId } } } // Remove the product from the array
        );

        if (result.modifiedCount > 0) {
            res.status(STATUS_CODE.OK).json({ success: true, message: COMMON_MESSAGES.ITEM_REMOVED_SUCCESSFULLY });
        } else {
            res.status(STATUS_CODE.NOT_FOUND).json({ success: false, message: COMMON_MESSAGES.ITEM_NOT_FOUND_IN_WISHLIST });
        }
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_REMOVING_ITEM_FROM_WISHLIST, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.AN_ERROR_OCCURRED_PLEASE_TRY_AGAIN });
    }
};




module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist
}