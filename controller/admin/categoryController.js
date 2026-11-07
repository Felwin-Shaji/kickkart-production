const { STATUS_CODE } = require("../../constants/StatusCode");
const { ADMIN_MESSAGES } = require("../../constants/messages/AdminMessages");
const Category = require("../../models/categorySchema")


const categoryInfo = async (req, res) => {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = 5; 
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({})
            .sort({ createdAt: -1 }) // Sort by most recent
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments()

        const totalPages = Math.ceil(totalCategories / limit);

        res.render('category', {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories
        });
    } catch (error) {
        console.error(ADMIN_MESSAGES.ERROR_FETCHING_CATEGORIES, error);
        res.redirect("/admin/errorPage");
    }
}

const addCategory = async (req, res) => {
    const { name, description } = req.body


    try {

        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ success: false, redirectUrl: '/login', message: ADMIN_MESSAGES.CATEGORY_ALREADY_EXISTS });
        }

        const newCategory = new Category({
            name,
            description,
        })

        await newCategory.save()
        return res.json({ success: true, redirectUrl: '/login', message: ADMIN_MESSAGES.CATEGORY_ADDED_SUCCESSFULLY })


    } catch (error) {
        return res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, redirectUrl: '/login', error: ADMIN_MESSAGES.INTERNAL_SERVER_ERROR_2 })
    }
}

const getEditCategory = async (req, res) => {
    try {
        const categoryId = req.params.id; 
        const { name, description } = req.body; 

        if (!name || !description) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ error: ADMIN_MESSAGES.NAME_AND_DESCRIPTION_ARE_REQUIRED });
        }

        // Update the category in the database
        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            { name, description },
            { new: true } // Return the updated document
        );

        // updatedCategory,updatedCategory)

        if (!updatedCategory) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ error: ADMIN_MESSAGES.CATEGORY_NOT_FOUND });
        }

        res.json({
            success: true,
            message: ADMIN_MESSAGES.CATEGORY_UPDATED_SUCCESSFULLY,
            category: updatedCategory
        });
    } catch (error) {
        console.error(ADMIN_MESSAGES.ERROR_UPDATING_CATEGORY, error);
        res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).json({ success: false, error: ADMIN_MESSAGES.INTERNAL_SERVER_ERROR });
    }
};

const listCategory = async (req, res) => {
    try {
        let _id = req.query;
        await Category.updateOne({ _id: _id }, { $set: { isListed: false } })
        res.redirect("/admin/category")
    } catch (error) {
        console.error(ADMIN_MESSAGES.LISTCATEGORY_ERROR);
        res.redirect("/admin/errorPage");
    }
}

const unListCategory = async (req, res) => {
    try {
        let _id = req.query;
        await Category.updateOne({ _id: _id }, { $set: { isListed: true } })
        res.redirect("/admin/category")
    } catch (error) {
        console.error(ADMIN_MESSAGES.UNLISTCATEGORY_ERROR);
        res.redirect("/admin/errorPage");
    }
}

module.exports = { categoryInfo, addCategory, listCategory, unListCategory, getEditCategory }