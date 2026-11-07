const { STATUS_CODE } = require("../../constants/StatusCode");
const { COMMON_MESSAGES } = require("../../constants/messages/CommonMessages");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const Product = require("../../models/productSchema")
const Wishlist = require("../../models/wishlistSchema")

const nodemailer = require('nodemailer')
const env = require('dotenv').config
const bcrypt = require("bcrypt");
const validator = require("validator")
const { login } = require("../admin/adminController");
const { EventEmitterAsyncResource } = require("nodemailer/lib/xoauth2");

function generateOtp() {
    console.log(Math.floor(100000 + Math.random() * 900000).toString());
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const pageNotFound = async (req, res) => {
    try {
        res.render('page-404')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const loadShopPage = async (req, res) => {
    try {
        const user = req.session.user;
        req.session.category = null;
        req.session.brand = null;
        req.session.gt = null;
        req.session.lt = null;

        const userData = await User.findOne({ _id: user });
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map((category) => category._id.toString());
        const page = parseInt(req.query.page) || 1;
        const limit = 16;
        const skip = (page - 1) * limit;

        const brands = await Brand.find({ isBlocked: false });

        const products = await Product.find({
            isBlocked: false,
            category: { $in: categoryIds },
            variants: { $elemMatch: { quantity: { $gt: 0 } } }
        }).sort({ createdAt: -1 }).skip(skip).limit(limit);


        const totalProducts = await Product.countDocuments({
            isBlocked: false,
            category: { $in: categoryIds },
            variants: { $elemMatch: { quantity: { $gt: 0 } } },
        });

        const wishlist = await Wishlist.findOne({ userId: user });
        const wishlistProductIds = wishlist
            ? wishlist.products.map(product => product.productId.toString())
            : [];


        const totalpages = Math.ceil(totalProducts / limit);

        const categoriesWidthIds = categories.map(category => ({ _id: category._id, name: category.name }));

        req.session.sort = req.session.sort || null;

        res.render("shop/shop", {
            user: userData,
            products: products,
            category: categoriesWidthIds,
            brand: brands,
            totalProducts: totalProducts,
            currentPage: page,
            totalpages: totalpages,
            wishlistProductIds,
            searchedProduct: "all Products",
            selectedCategory: "",
            selectedPrice: "",
            selectedBrand: "",
            selectedSort: "",
        })

    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        req.session.category = req.query.category || req.session.category || null;
        req.session.brand = req.query.brand || req.session.brand || null;
        req.session.gt = req.query.gt || req.session.gt || null;
        req.session.lt = req.query.lt || req.session.lt || null;
        req.session.sort = req.query.sort || req.session.sort || null;


        const brands = await Brand.find({}).lean();
        const categories = await Category.find({ isListed: true }).lean();

        const wishlist = await Wishlist.findOne({ userId: user });
        const wishlistProductIds = wishlist
            ? wishlist.products.map(product => product.productId.toString())
            : [];

        const query = {
            isBlocked: false,
            variants: {
                $elemMatch: {
                    quantity: { $gt: 0 },
                },
            },
        };

        if (req.session.category) {
            const findCategory = await Category.findOne({ _id: req.session.category });
            if (findCategory) {
                query.category = findCategory._id;
            }
        }

        if (req.session.brand) {
            const findBrand = await Brand.findOne({ _id: req.session.brand });
            if (findBrand) {
                query.brand = findBrand.brandName;
            }
        }

        if (req.session.gt || req.session.lt) {
            query.salePrice = {};
            if (req.session.gt) query.salePrice.$gte = parseInt(req.session.gt);
            if (req.session.lt) query.salePrice.$lte = parseInt(req.session.lt);
        }


        let findProducts = await Product.find(query).lean();


        if (req.session.sort) {
            switch (req.session.sort) {
                case 'priceLowToHigh':
                    findProducts.sort((a, b) => a.salePrice - b.salePrice);
                    break;
                case 'priceHighToLow':
                    findProducts.sort((a, b) => b.salePrice - a.salePrice);
                    break;
                case 'Aa-Zz':
                    findProducts.sort((a, b) =>
                        a.productName.toLowerCase().localeCompare(b.productName.toLowerCase())
                    );
                    break;
                case 'Zz-Aa':
                    findProducts.sort((a, b) =>
                        b.productName.toLowerCase().localeCompare(a.productName.toLowerCase())
                    );
                    break;
                default:
                    findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }
        }

        const itemsPerPage = 16;
        const currentPage = parseInt(req.query.page) || 1;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProducts = findProducts.slice(startIndex, startIndex + itemsPerPage);


        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
            if (userData) {
                const searchEntry = {
                    category: req.session.category || null,
                    brand: req.session.brand || null,
                    priceRange: { gt: req.session.gt, lt: req.session.lt },
                    searchedOn: new Date(),
                };
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }

        req.session.filteredProducts = currentProducts;

        res.render('shop/shop', {
            user: userData,
            products: currentProducts,
            category: categories,
            brand: brands,
            totalpages: totalPages,
            currentPage,
            selectedCategory: req.session.category || null,
            selectedBrand: req.session.brand || null,
            selectedPrice: req.session.gt && req.session.lt ? `${req.session.gt}-${req.session.lt}` : null,
            searchedProduct: 'Search here',
            selectedSort: req.session.sort,
            wishlistProductIds
        });
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_FILTERING_PRODUCTS, error);
        res.redirect('/pageNotFound');
    }
};

const filterPrice = async (req, res) => {

}

const searchProduct = async (req, res) => {
    try {
        const userId = req.session.user;
        let userData = null;
        if (userId) {
            userData = await User.findOne({ _id: userId });
        }

        const searchQuery = req.body.search || "";
        // Search Query:, searchQuery);

        const wishlist = await Wishlist.findOne({ userId: userId });
        const wishlistProductIds = wishlist
            ? wishlist.products.map(product => product.productId.toString())
            : [];

        const categories = await Category.find({
            isListed: true,
            name: { $regex: `.*${searchQuery}.*`, $options: "i" }
        }).lean();

        const brands = await Brand.find({
            brandName: { $regex: `.*${searchQuery}.*`, $options: "i" }
        }).lean();

        const matchedCategoryIds = categories.map(category => category._id);
        const matchedBrandNames = brands.map(brand => brand.brandName);

        const searchResult = await Product.find({
            $or: [
                { productName: { $regex: `.*${searchQuery}.*`, $options: "i" } },
                { category: { $in: matchedCategoryIds } },
                { brand: { $in: matchedBrandNames } }
            ],
            isBlocked: false,
            variants: { $elemMatch: { quantity: { $gt: 0 } } }
        }).lean();

        searchResult.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const ipage = 6;
        const currentPage = parseInt(req.query.page) || 1;
        const startIndex = (currentPage - 1) * ipage;
        const endIndex = startIndex + ipage;
        const totalPages = Math.ceil(searchResult.length / ipage);
        const currentProduct = searchResult.slice(startIndex, endIndex);

        req.session.filteredProducts = searchResult;

        res.render('shop/shop', {
            user: userData,
            products: currentProduct,
            category: categories,
            totalProducts: searchResult.length,
            brand: brands,
            totalpages: totalPages,
            currentPage,
            count: searchResult.length,
            searchedProduct: searchQuery,
            selectedPrice: "",
            selectedCategory: "",
            selectedBrand: "",
            selectedSort: "",
            wishlistProductIds
        });

    } catch (error) {
        console.log(COMMON_MESSAGES.ERROR_IN_SEARCHPRODUCT, error);
        res.redirect("/pageNotFound");
    }
};

const loadHomePage = async (req, res) => {
    try {
        const user = req.session.user;

        const categories = await Category.find({ isListed: true })

        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            variants: { $elemMatch: { quantity: { $gt: 0 } } }
        })
            .sort({ createdAt: -1 }) // Sort by creation date in descending order
            .limit(4); // Limit to 4 products

        const varientSize = productData.flatMap(product => product.variants.map(variant => variant.size));
        const varientColor = productData.flatMap(product => product.variants.map(variant => variant.color));
        const varientQuantity = productData.flatMap(product => product.variants.map(variant => variant.quantity));

        if (user) {
            const userData = await User.findById(user)
            res.render('index', {
                user: userData,
                products: productData,
                varientSize: varientSize,
                varientColor: varientColor,
                varientQuantity: varientQuantity,
            });
        } else {
            return res.render('index', {
                products: productData,
                varientSize: varientSize,
                varientColor: varientColor,
                varientQuantity: varientQuantity,
            });
        }
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_LOADING_HOME_PAGE, error.message);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send(COMMON_MESSAGES.SERVER_ERROR_2);
    }
}

const loadSignup = async (req, res) => {
    try {
        const user = req.session.user
        if (!user) {
            return res.render('auth/signup')
        }
    } catch (error) {
        console.log(COMMON_MESSAGES.HOME_PAGE_NOT_LOADING, error)
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send(COMMON_MESSAGES.SERVER_ERROR);
    }
}

async function sendVerificationEmail(email, otp) {    ////nodemailer
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // true for port 465, false for other ports
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: 'Verify your account',
            text: `Your OTP is ${otp}`,
            html: `your OTP : ${otp}</b>`,
        })

        return info.accepted.length > 0
    } catch (error) {
        console.log(COMMON_MESSAGES.ERROR_SENDING_EMAIL, error);
        return false;
    }
}

const signup = async (req, res) => {
    try {
        const { name, phone, email, password, confirmPassword, referralCodeInput } = req.body;
        // yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy, req.body)

        // req.body, req.body);

        if (!name || !phone || !email || !password || !confirmPassword) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: COMMON_MESSAGES.ALL_FIELDS_ARE_REQUIRED });
        }

        if (password !== confirmPassword) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: COMMON_MESSAGES.PASSWORDS_DO_NOT_MATCH });
        }

        if (!validator.isEmail(email)) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: COMMON_MESSAGES.INVALID_EMAIL_FORMAT });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: COMMON_MESSAGES.EMAIL_ALREADY_IN_USE });
        }

        const otp = generateOtp();
        // Signup successful, OTP sent, otp);

        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.FAILED_TO_SEND_OTP_PLEASE_TRY_AGAIN_2 });
        }

        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password, referralCodeInput };
        req.session.otpExpiry = Date.now() + 60000;

        // Signup successful, OTP sent, req.session.userOtp);

        return res.status(STATUS_CODE.OK).json({ success: true, message: COMMON_MESSAGES.OTP_SENT_SUCCESSFULLY, redirectTo: '/verify-otp' });
    } catch (error) {
        console.error(COMMON_MESSAGES.SIGNUP_ERROR, error);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR_2 });
    }
};

const verifyReferralCode = async (req, res) => {
    try {
        const { referralCode } = req.body;

        if (!referralCode) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: COMMON_MESSAGES.REFERRAL_CODE_IS_REQUIRED });
        }

        const user = await User.findOne({ referalCode: referralCode });

        if (user) {
            return res.status(STATUS_CODE.OK).json({
                message: COMMON_MESSAGES.REFERRAL_CODE_IS_VALID,  //userName: user.name, // Optional: Provide additional info, like the referrer's name
            });
        } else {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: COMMON_MESSAGES.INVALID_REFERRAL_CODE });
        }
    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_VERIFYING_REFERRAL_CODE, error);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ message: COMMON_MESSAGES.SERVER_ERROR_PLEASE_TRY_AGAIN_LATER });
    }
};

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash;
    } catch (error) {

    }
}

const getVerifyOTP = async (req, res) => {
    try {
        const otp = req.session.userOtp;

        if (!otp) {
            console.error(COMMON_MESSAGES.OTP_EXPIRED_OR_NOT_FOUND_IN_SESSION);
            return res.redirect("/pageNotFound");
        }

        res.render("auth/Verify-Otp");
    } catch (error) {
        console.error(COMMON_MESSAGES.GET_VERIFY_OTP_ERROR, error.message || error);
        res.redirect("/pageNotFound");
    }
};

const verifyOtp = async (req, res) => {
    try {
        const user = req.session.userData;
        const { otp } = req.body;
        //const userData = req.session.userData
        // ooooo, req.body)

        if (!otp || !user) {
            console.error(COMMON_MESSAGES.MISSING_OTP_OR_USER_DATA_IN_SESSION);
            return res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: COMMON_MESSAGES.SESSION_EXPIRED_OR_INVALID_DATA_PLEASE_TRY_AGAIN,
            });
        }

        // Received OTP:, otp);

        if (otp === req.session.userOtp) {

            const passwordHash = await securePassword(user.password);

            let saveUserData
            if (!user.referralCodeInput) {

                saveUserData = new User({
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    password: passwordHash,
                });
            } else if (user.referralCodeInput) {
                const referalUser = await User.findOne({ referalCode: user.referralCodeInput }); // Use findOne instead of find
                if (!referalUser) {
                    return res.status(STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: COMMON_MESSAGES.INVALID_REFERRAL_CODE_PLEASE_TRY_AGAIN,
                    });
                }

                saveUserData = new User({
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    password: passwordHash,
                    wallet: {
                        balance: 50, // Example: Adding initial balance for referral
                        transactions: [
                            {
                                type: "credit",
                                amount: 50,
                                description: "Referral bonus",
                                date: new Date(),
                            },
                        ],
                    },
                });

                referalUser.wallet.balance += 500; // Example: Adding bonus to the referrer
                referalUser.wallet.transactions.push({
                    type: "credit",
                    amount: 500,
                    description: `Referral bonus for referring ${user.name}`,
                    date: new Date(),
                });
                referalUser.redeemedUser.push(saveUserData._id);

                await referalUser.save();
            }


            await saveUserData.save();

            req.session.user = saveUserData;

            delete req.session.userOtp;
            delete req.session.userData;

            res.json({
                success: true,
                message: COMMON_MESSAGES.OTP_VERIFIED_SUCCESSFULLY,
                redirectUrl: "/login",
            });
        } else {
            console.error(COMMON_MESSAGES.INVALID_OTP_ENTERED);
            res.status(STATUS_CODE.BAD_REQUEST).json({
                success: false,
                message: COMMON_MESSAGES.INVALID_OTP_PLEASE_TRY_AGAIN,
            });
        }
    } catch (error) {
        console.error(COMMON_MESSAGES.VERIFY_OTP_ERROR, error.message || error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: COMMON_MESSAGES.AN_INTERNAL_ERROR_OCCURRED_PLEASE_TRY_AGAIN_LATER,
        });
    }
};

const resendOtp = async (req, res) => {
    try {

        const { email } = req.session.userData
        if (!email) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: COMMON_MESSAGES.EMAIL_NOT_FOUND_IN_SESSION })
        }
        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            // Resend Otp :, otp);
            res.status(STATUS_CODE.OK).json({ success: true, message: COMMON_MESSAGES.OTP_RESEND_SUCCESSFULLY })
        } else {
            res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.FAILED_TO_RESEND_OTP_PLEASE_TRY_AGAIN });
        }

    } catch (error) {
        console.error(COMMON_MESSAGES.ERROR_RESENDING_OTP, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: COMMON_MESSAGES.INTERNAL_SERVER_ERROR_PLEASE_TRY_AGAIN })
    }
}

const loadLogin = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.render('auth/loginPage')
        } else {
            res.redirect('/')
        }
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const Login = async (req, res) => {
    try {

        const { email, password } = req.body;

        const findUser = await User.findOne({ isAdmin: 0, email: email })



        if (!findUser) {
            return res.json({
                sucess: false,
                message: COMMON_MESSAGES.USER_NOT_FOUND_2,
                redirectUrl: '/login',
            })
        }
        if (findUser.isBlocked) {
            return res.json({
                sucess: false,
                message: COMMON_MESSAGES.USER_IS_BLOCKED_BY_ADMIN,
                redirectUrl: '/login'
            })
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        if (!passwordMatch) {
            return res.json({
                success: false,
                message: COMMON_MESSAGES.INCORRECT_PASSWORD,
                redirectUrl: '/login'
            })
        }

        req.session.user = findUser._id;


        return res.json({
            success: true,
            message: COMMON_MESSAGES.LOGIN_SUCCESSFULL,
            redirectUrl: '/'
        });


    } catch (error) {
        console.error(COMMON_MESSAGES.LOGIN_ERROR, error)
        res.render('auth/login', { message: COMMON_MESSAGES.LOGIN_FAILED_PLEASE_TRY_AGAIN_LATER })
    }
}

const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log(COMMON_MESSAGES.SESSION_DESTRUCTION_ERROR, err.message);
                return res.redirect('/pageNotFound');
            }
            res.clearCookie('connect.sid');
            res.redirect('/');
        });
    } catch (error) {
        console.log(COMMON_MESSAGES.LOGOUT_ERROR, error);
        res.redirect('/pageNotFound');
    }
};

const googleVerification = async (req, res) => {
    req.session.user = req.user.id
    res.redirect('/')
}

module.exports = {
    loadHomePage,
    pageNotFound,
    loadSignup,
    signup,
    verifyReferralCode,
    getVerifyOTP,
    verifyOtp,
    googleVerification,
    resendOtp,
    loadLogin,
    Login,
    logout,
    loadShopPage,
    filterProduct,
    filterPrice,
    searchProduct,
}
