const { STATUS_CODE } = require("../../constants/StatusCode");
const { ADMIN_MESSAGES } = require("../../constants/messages/AdminMessages");
const Brand = require("../../models/brandSchema")
const Product = require("../../models/productSchema")


const getBrandPage = async (req, res) => {
    //res.render("brand")
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit

        const brandData = await Brand.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalBrands = await Brand.countDocuments();
        const totalPages = Math.ceil(totalBrands / limit);
        const reverseBrand = brandData.reverse();

        res.render("brand", {
            data: reverseBrand,
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrands,
        })

    } catch (error) {
        console.log(ADMIN_MESSAGES.GET_BRAND_PAGE_ERROR);
        res.redirect("/admin/errorPage");
    }
}

const addBrands = async (req, res) => {
    try {

        const { brandName, brandDescription } = req.body;

        const findBrand = await Brand.findOne({ brandName });

        if (findBrand) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: ADMIN_MESSAGES.BRAND_ALREADY_EXISTS });
        }

        const image = req.file.filename;

        if (!image) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, message: ADMIN_MESSAGES.BRAND_IMAGE_IS_REQUIRED });
        }

        const newBrand = new Brand({
            brandName: brandName,
            brandImage: image,
            description: brandDescription
        })


        await newBrand.save();
        res.status(STATUS_CODE.OK).json({
            success: true,
            message: ADMIN_MESSAGES.BRAND_ADDED_SUCCESSFULLY,
            newBrand,
            redirectUrl: '/admin/brands'
        });

    } catch (error) {
        console.error(ADMIN_MESSAGES.ERROR_IN_ADDBRANDS_FUNCTION, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: ADMIN_MESSAGES.AN_ERROR_OCCURRED_WHILE_ADDING_THE_BRAND });
    }
}


const listCategory = async (req, res) => {
    try {
        const { _id } = req.query;

        console.log(_id)

        const brand = await Brand.findByIdAndUpdate({ _id }, [{ $set: { isBlocked: { $not: '$isBlocked' } } }], { new: true }); // Retrieve the user document

        console.log(brand)
        if (!brand) {
            return res.status(STATUS_CODE.NOT_FOUND).render('pageNOtFound', { error: ADMIN_MESSAGES.USER_NOT_FOUND })
        }

        res.redirect('/admin/brands')

    } catch (error) {
        console.log(error.message);
        res.redirect("/admin/errorPage");
    }
};

const deleteBrand = async (req, res) => {
    try {
        const { _id } = req.query
        console.log(req.query, ',,,,,,,,', { _id });

        if (!_id) {
            // Brand does not exists);
            return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, redirectUrl: '/admin/deleteBrand' })
        }
        await Brand.deleteOne({ _id })
       

        return res.json({ success: true, redirectUrl: 'admin/deleteBrand', message: ADMIN_MESSAGES.BRAND_DELETED_SUCCESSFULLY })

    } catch (error) {
        console.error(ADMIN_MESSAGES.ERROR_DELETING_BRAND, error);
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, message: ADMIN_MESSAGES.INTERNAL_SERVER_ERROR });
    }
}


module.exports = {
    getBrandPage,
    addBrands,
    listCategory,
    deleteBrand,
}