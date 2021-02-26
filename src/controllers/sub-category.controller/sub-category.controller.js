import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExist, checkExistThenGet } from "../../helpers/CheckMethods";
import { handleImg, checkValidations } from "../shared.controller/shared.controller";
import { body } from "express-validator/check";
import SubCategory from "../../models/category.model/category.model";
import Product from "../../models/product.model/product.model"
import i18n from 'i18n'
import dotObject from 'dot-object';
import moment from 'moment'
import favoritesModel from "../../models/favorites.model/favorites.model";

let populateQuery = [{ path: 'parent', model: 'category' }]


export default {

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let { name, month, year, parent,all,client} = req.query
            let query = { deleted: false, parent: { $ne: null } };
            if (name) {
                query.$or = [{ 'name.en': { '$regex': name, '$options': 'i' } }, { 'name.ar': { '$regex': name, '$options': 'i' } }]
            }
            let date = new Date();
            if (parent) {
                query.parent = parent
            }
            if ((!client) && parent) {
                let otherCategory = await SubCategory.findOne({deleted:false,image:'/otherImage.png',name:{ar:'اخري',en:'OTHER'},parent:parent});
                if (otherCategory) {
                    let productsCounts = await Product.count({deleted:false,category:otherCategory.id});
                    if (productsCounts == 0) {
                        query._id = {$ne:otherCategory.id};
                    }
                }
            }
            if (month && year) {
                month = month - 1;
                date.setMonth(month);
                date.setFullYear(year);
                let startOfDate = moment(date).startOf('month');
                let endOfDate = moment(date).endOf('month');

                query.createdAt = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) }
            }
            if (year && !month) {
                date.setFullYear(year);
                let startOfDate = moment(date).startOf('year');
                let endOfDate = moment(date).endOf('year');
                query.createdAt = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) }
            }

            const categoriesCount = await SubCategory.count(query);
            let categories;
            let pageCount = categoriesCount;
            if (all) {
                limit = pageCount;
                categories = await SubCategory.find(query).sort({ createdAt: -1 }).populate(populateQuery)
            }
            else {
                pageCount = Math.ceil(categoriesCount / limit);
                categories = await SubCategory.find(query).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit).populate(populateQuery)
            }
            categories = SubCategory.schema.methods.toJSONLocalizedOnly(categories, i18n.getLocale());
            res.send(new ApiResponse(categories, page, pageCount, limit, categoriesCount, req));
        } catch (err) {
            next(err);
        }
    },

    validateBody(isUpdate = false) {
        let validations = [];
        if (!isUpdate) {
            validations = [
                body('parent').not().isEmpty().withMessage(() => { return i18n.__('categoryRequired') })
                    .custom(async (value) => {
                        await checkExist(value, SubCategory, { deleted: false });
                    }),
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') })
                    .custom(async (val, { req }) => {
                        let query = { 'name.en': val, deleted: false };
                        if (isUpdate)
                            query._id = { $ne: req.params.subcategoryId };
                        let subcategory = await SubCategory.findOne(query).lean();
                        if (subcategory)
                            throw new Error(i18n.__('englishNameDublicated'));
                        return true;
                    }),
                body('name.ar').not().isEmpty().withMessage(() => { return i18n.__('arabicName') })
                    .custom(async (val, { req }) => {
                        let query = { 'name.ar': val, deleted: false };
                        if (isUpdate)
                            query._id = { $ne: req.params.subcategoryId };
                        let subcategory = await SubCategory.findOne(query).lean();
                        if (subcategory)
                            throw new Error(i18n.__('arabicNameDublicated'));
                        return true;
                    })
            ];
        }
        else {
            validations = [
                body('parent').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryRequired') })
                    .custom(async (value) => {
                        await checkExist(value, SubCategory, { deleted: false });
                    }),
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') })
                    .custom(async (val, { req }) => {
                        let query = { 'name.en': val, deleted: false };
                        if (isUpdate)
                            query._id = { $ne: req.params.subcategoryId };
                        let subcategory = await SubCategory.findOne(query).lean();
                        if (subcategory)
                            throw new Error(i18n.__('englishNameDublicated'));
                        return true;
                    }),
                body('name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('arabicName') })
                    .custom(async (val, { req }) => {
                        let query = { 'name.ar': val, deleted: false };
                        if (isUpdate)
                            query._id = { $ne: req.params.subcategoryId };
                        let subcategory = await SubCategory.findOne(query).lean();
                        if (subcategory)
                            throw new Error(i18n.__('arabicNameDublicated'));
                        return true;
                    }),
            ];
        }
        return validations;
    },

    async create(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, ('admin.auth')));
            let validatedBody = checkValidations(req);
            validatedBody.image = await handleImg(req, { attributeName: 'image', isUpdate: false },i18n.__('imagesRequired'))
            //////////////////////////////////////////////////
            let products = await Product.find({category: validatedBody.parent}).distinct('_id');
            if(products.length > 0){
                let newSub = await SubCategory.create({image:'/otherImage.png',name:{ar:'اخري',en:'OTHER'},parent:validatedBody.parent});
                await Product.updateMany({_id:{$in:products}},{category:newSub.id})
            }
            /////////////////////////////////////////////////
            let createdsubCategory = await SubCategory.create(validatedBody);
            createdsubCategory = SubCategory.schema.methods.toJSONLocalizedOnly(createdsubCategory, i18n.getLocale());
            res.status(200).send(createdsubCategory);
            await SubCategory.findByIdAndUpdate(validatedBody.parent, { hasChild: true })
            
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { subcategoryId } = req.params;
            let { removeLanguage } = req.query;
            var subcategory = await checkExistThenGet(subcategoryId, SubCategory, { deleted: false, populate: populateQuery });
            if (!removeLanguage) {
                subcategory = SubCategory.schema.methods.toJSONLocalizedOnly(subcategory, i18n.getLocale());
            }
            res.status(200).send(subcategory);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, ('admin.auth')));

            let { subcategoryId } = req.params;
            let { removeLanguage } = req.query;
            let subcategory = await checkExistThenGet(subcategoryId, SubCategory, { deleted: false });
            var validatedBody = checkValidations(req);
            if (req.file)
                validatedBody.image = await handleImg(req, { attributeName: 'image', isUpdate: true })

            if (subcategory.parent != +validatedBody.parent) {
                await SubCategory.findByIdAndUpdate(validatedBody.parent, { hasChild: true })
                let prevParentSub = await SubCategory.find({ deleted: false, parent: subcategory.parent,_id:{$ne:subcategoryId} })
                if (prevParentSub.length == 0)
                    await SubCategory.findByIdAndUpdate(subcategory.parent, { hasChild: false })
            }
            validatedBody = dotObject.dot(validatedBody);
            let updatedsubCategory = await SubCategory.findByIdAndUpdate(subcategoryId, validatedBody, { new: true }).populate(populateQuery)
            if (!removeLanguage) {
                updatedsubCategory = SubCategory.schema.methods.toJSONLocalizedOnly(updatedsubCategory, i18n.getLocale());
            }
            res.status(200).send(updatedsubCategory);
        }
        catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, ('admin.auth')));

            let { subcategoryId } = req.params;
            let subcategory = await checkExistThenGet(subcategoryId, SubCategory, { deleted: false });
            subcategory.deleted = true;
            await subcategory.save();
            res.status(200).send('Deleted Successfully');
            let products = await Product.find({deleted: false,category: subcategoryId}).distinct('_id');
            await Product.updateMany({deleted: false,category: subcategoryId},{deleted: true})
            await favoritesModel.updateMany({deleted: false,product: {$in: products}},{deleted: true})
            let subcategories = await SubCategory.find({ deleted: false, parent: subcategory.parent })
            if (subcategories.length == 0)
                await SubCategory.findByIdAndUpdate(subcategory.parent, { hasChild: false })
        }
        catch (err) {
            next(err);
        }
    },
};