const { STATUS_CODE } = require("../../constants/StatusCode");
const { ADMIN_MESSAGES } = require("../../constants/messages/AdminMessages");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema")

const { validationResult } = require("express-validator");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const getAddProduct = async (req, res) => {
    try {

        const categoryData = await Category.find({ isListed: true });
        const brandData = await Brand.find({ isBlocked: false });
        res.render("product/add-Product-Page", {
            cat: categoryData,
            brand: brandData
        });

    } catch (error) {
        console.log(ADMIN_MESSAGES.ERROR_IN_GETADDPRODUCT_PAGE);
        res.redirect("/admin/errorPage");
    }

}

const addProducts = async (req, res) => {
    try {
        // Validate request body fields
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ADMIN_MESSAGES.VALIDATION_FAILED, errors: errors.array() });
        }

        const {
            productName,
            brand,
            description,
            regularPrice,
            category,
            variantSize,
            variantQuantity,
        } = req.body;

        // Check if required fields are empty
        if (!productName || !brand || !description || !regularPrice || !category || !variantSize || !variantQuantity) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ADMIN_MESSAGES.ALL_FIELDS_ARE_REQUIRED_2 });
        }

        // Ensure price is a valid number
        if (isNaN(regularPrice) || parseFloat(regularPrice) <= 0) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ADMIN_MESSAGES.REGULAR_PRICE_MUST_BE_A_VALID_POSITIVE_NUMBER });
        }

        // Check if product already exists
        const productExists = await Product.findOne({ productName });
        if (productExists) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ADMIN_MESSAGES.PRODUCT_ALREADY_EXISTS_PLEASE_TRY_ANOTHER_NAME });
        }

        // Check for valid category
        const categoryDoc = await Category.findOne({ name: category });
        if (!categoryDoc) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ADMIN_MESSAGES.INVALID_CATEGORY_NAME });
        }

        // Validate variants (ensure arrays are not empty and values are valid)
        if (!Array.isArray(variantSize) || !Array.isArray(variantQuantity) || variantSize.length === 0) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ADMIN_MESSAGES.AT_LEAST_ONE_VARIANT_IS_REQUIRED });
        }

        const variants = variantSize.map((size, index) => {
            const quantity = parseInt(variantQuantity[index], 10);
            if (!size || isNaN(quantity) || quantity < 0) {
                throw new Error(ADMIN_MESSAGES.INVALID_VARIANT_DATA_AT_INDEX.replace("{index}", index + 1));
            }
            return { size, quantity };
        });

        // Process images
        const images = [];
        if (req.files && req.files.length > 2) {
            for (let file of req.files) {
                const originalImagePath = file.path;
                const resizedImagePath = path.join("public", "uploads", "product-images", file.filename);

                await sharp(originalImagePath)
                    .resize({ width: 440, height: 440 })
                    .toFile(resizedImagePath);

                images.push(file.filename);
            }
        } else {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ADMIN_MESSAGES.AT_LEAST_THREE_PRODUCT_IMAGE_IS_REQUIRED });
        }

        // Create and save new product
        const newProduct = new Product({
            productName,
            description,
            brand,
            category: categoryDoc._id,
            regularPrice: parseFloat(regularPrice),
            productImage: images,
            variants,
            isOfferActive: categoryDoc.categoryOffer || 0,
            status: "Available",
        });

        await newProduct.save();

        return res.status(STATUS_CODE.CREATED).json({
            success: true,
            message: ADMIN_MESSAGES.PRODUCT_ADDED_SUCCESSFULLY,
            redirectUrl: "/admin/products"
        });

    } catch (error) {
        console.error(ADMIN_MESSAGES.ERROR_SAVING_PRODUCT, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
};

const getAllProducts = async (req, res) => {
    try {

        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 8;


        const productQuery = {
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                { brand: { $regex: new RegExp(".*" + search + ".*", "i") } },
            ],
        };

        const productData = await Product.find(productQuery)
            .limit(limit)
            .skip((page - 1) * limit)
            .populate("category")
            .exec();
        // 111111, productData)

        const count = await Product.countDocuments(productQuery);

        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });

        if (category && brand) {
            res.render("product/product-page", {
                data: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,
                brand: brand,
            });
        } else {

            res.redirect("/pageNotFound");
        }
    } catch (error) {
        console.error(ADMIN_MESSAGES.ERROR_FETCHING_PRODUCTS, error);
        res.redirect("/admin/errorPage");
    }
};

const blockProduct = async (req, res) => {
    try {
        let { _id } = req.query;


        await Product.updateOne({ _id: _id }, { $set: { isBlocked: true } });

        res.redirect("/admin/products")
    } catch (error) {
        console.log(ADMIN_MESSAGES.ERROR_ON_THE_BLOCKPRODUCT_FUNCTION)
        res.redirect("/admin/errorPage");
    }
}

const unBlockProduct = async (req, res) => {
    try {
        let { _id } = req.query;

        await Product.updateOne({ _id: _id }, { $set: { isBlocked: false } });

        res.redirect("/admin/products")
    } catch (error) {
        console.log(ADMIN_MESSAGES.ERROR_ON_THE_UNBLOCKPRODUCT_FUNCTION)
        res.redirect("/admin/errorPage");
    }
}

const getEditProduct = async (req, res) => {
    try {

        let { _id } = req.query;
        const product = await Product.findOne({ _id: _id }).populate("category");
        const category = await Category.find({})
        const brand = await Brand.find({});

        res.render("product/edit-product", {
            product: product,
            cat: category,
            brand: brand
        })

    } catch (error) {
        console.log(ADMIN_MESSAGES.GET_EDIT_PRODUCT_ERROR, error)
        res.redirect("/admin/errorPage");
    }
}

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;

        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        if (existingProduct) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ error: ADMIN_MESSAGES.PRODUCT_WITH_THIS_NAME_ALREADY_EXISTS_PLEASE_TRY_ANOTHER_NAME });
        }

        const category = await Category.findOne({ name: data.category });
        if (!category) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ error: ADMIN_MESSAGES.INVALID_CATEGORY_NAME });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ error: ADMIN_MESSAGES.PRODUCT_NOT_FOUND });
        }

        const images = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const originalImagePath = req.files[i].path;
                const resizedImagePath = path.join("public", "uploads", "product-images", req.files[i].filename);

                await sharp(originalImagePath)
                    .resize({ width: 440, height: 440 })
                    .toFile(resizedImagePath);

                images.push(req.files[i].filename);
            }
        }

        if (images.length > 0) {
            product.productImage.push(...images);
        }

        product.variants = data.variantSize.map((size, index) => ({
            size,
            quantity: data.variantQuantity[index],
        }));

        product.productName = data.productName;
        product.description = data.description;
        product.brand = data.brand;
        product.category = category._id;
        product.regularPrice = parseFloat(data.regularPrice);

        // Save the updated product (this will trigger the `pre('save')` middleware)
        await product.save();

        res.redirect("/admin/products");
    } catch (error) {
        console.error(ADMIN_MESSAGES.EDIT_PRODUCT_ERROR, error);
        res.redirect("/admin/errorPage");
    }
};

const deleteSingleImage = async (req, res) => {
    try {
        // req.body, req.body);

        const { imageId, productId } = req.body;
        const product = await Product.findByIdAndUpdate(productId, { $pull: { productImage: imageId } });
        res.status(STATUS_CODE.OK).json({ success: true, message: ADMIN_MESSAGES.IMAGE_DELETED_SUCCESSFULLY });
        const imagePath = path.join("public", "uploads", "product-image", imageId);
        // imagePath, imagePath)
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`image ${imageId} deleted successfully`);
            return res.status(STATUS_CODE.OK).json({ success: true, message: ADMIN_MESSAGES.IMAGE_DELETED_SUCCESSFULLY });
        } else {
            console.log(ADMIN_MESSAGES.IMAGE_NOT_FOUND, imageId);
        }
    } catch (error) {
        res.redirect("/admin/errorPage");
    }
}

const addOffer = async (req, res) => {
    try {
        const productId = req.params.productId;
        const { offer } = req.body;

        if (!productId) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: ADMIN_MESSAGES.PRODUCT_ID_IS_REQUIRED });
        }

        const product = await Product.findOne({ _id: productId }).populate('category');

        if (!product) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ success: false, message: ADMIN_MESSAGES.PRODUCT_NOT_FOUND });
        }

        const productOffer = parseFloat(offer || 0);
        const categoryOffer = product.category?.categoryOffer || 0;

        const highestOffer = Math.max(productOffer, categoryOffer);

        product.isOfferActive = highestOffer;


        await product.save();

        return res.status(STATUS_CODE.OK).json({
            success: true,
            message: highestOffer === 0
                ? "Offer removed successfully!"
                : "Offer added/updated successfully!",
        });
    } catch (error) {
        console.error(ADMIN_MESSAGES.ERROR_ADDING_OFFER, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: ADMIN_MESSAGES.INTERNAL_SERVER_ERROR_3 });
    }
};

const addCategoryOffer = async (req, res) => {
    const { categoryId, offerValue } = req.body;

    try {

        if (!categoryId || offerValue === undefined) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: ADMIN_MESSAGES.CATEGORY_ID_AND_OFFER_VALUE_ARE_REQUIRED,
            });
        }

        if (isNaN(offerValue)) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: ADMIN_MESSAGES.OFFER_VALUE_MUST_BE_A_VALID_NUMBER,
            });
        }

        const percentageValue = parseFloat(offerValue);

        if (percentageValue < 0 || percentageValue > 100) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: ADMIN_MESSAGES.OFFER_VALUE_MUST_BE_BETWEEN_0_AND_100_INCLUSIVE,
            });
        }


        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: ADMIN_MESSAGES.CATEGORY_NOT_FOUND,
            });
        }

        await Category.findByIdAndUpdate(categoryId, { categoryOffer: percentageValue });


        const products = await Product.find({ category: categoryId });

        const updatePromises = products.map(async (product) => {
            const productOffer = product.productOffer || 0;
            const highestOffer = Math.max(productOffer, percentageValue);

            product.isOfferActive = highestOffer;

            return product.save();
        });

        await Promise.all(updatePromises);

        res.status(STATUS_CODE.OK).json({
            success: true,
            message: ADMIN_MESSAGES.CATEGORY_OFFER_ADDED_SUCCESSFULLY_AND_ALL_RELATED_PRODUCTS_UPDATED,
        });
    } catch (error) {
        console.error(ADMIN_MESSAGES.ERROR_ADDING_CATEGORY_OFFER, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ADMIN_MESSAGES.FAILED_TO_ADD_CATEGORY_OFFER_DUE_TO_A_SERVER_ERROR,
        });
    }
};

module.exports = {
    getAddProduct,
    addProducts,
    getAllProducts,
    blockProduct,
    unBlockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    addOffer,
    addCategoryOffer
}