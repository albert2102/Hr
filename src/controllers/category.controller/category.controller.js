import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExist, checkExistThenGet } from "../../helpers/CheckMethods";
import { checkValidations, fieldhandleImg,deleteImages } from "../shared.controller/shared.controller";
import { body } from "express-validator/check";
import Category from "../../models/category.model/category.model";
import Company from "../../models/company.model/company.model";
import i18n from 'i18n'
import dotObject from 'dot-object';
import moment from 'moment'
import Product from "../../models/product.model/product.model";
import Size from "../../models/size.model/size.model";
import TradeMark from "../../models/tradeMark.model/tradeMark.model";
import favoritesModel from "../../models/favorites.model/favorites.model";
import rateModel from "../../models/rate.model/rate.model";
export default {

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let { name, month, year, all,type , removeLanguage } = req.query
            let query = { deleted: false, parent: { $eq: null },type: null };
            if (name) {
                query.$or = [{ 'name.en': { '$regex': name, '$options': 'i' } }, { 'name.ar': { '$regex': name, '$options': 'i' } }]
            }
            if (type) query.type = type;
            let date = new Date();
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
            const categoriesCount = await Category.count(query);
            let categories;
            let pageCount = categoriesCount;
            if (all) {
                limit = pageCount;
                categories = await Category.find(query).sort({ createdAt: -1 })
            }
            else {
                pageCount = Math.ceil(categoriesCount / limit);
                categories = await Category.find(query).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit)
            }
            if (!removeLanguage) {
                categories = Category.schema.methods.toJSONLocalizedOnly(categories, i18n.getLocale());
            }

            res.send(new ApiResponse(categories, page, pageCount, limit, categoriesCount, req));
        } catch (err) {
            next(err);
        }
    },

    validateBody(isUpdate = false) {
        let validations = [];
        if (!isUpdate) {
            validations = [
                body('name.en').not().isEmpty().withMessage(() => { return i18n.__('englishName') })
                    .custom(async (val, { req }) => {
                        let query = { 'name.en': val, deleted: false };
                        let category = await Category.findOne(query).lean();
                        if (category)
                            throw new Error(i18n.__('englishNameDublicated'));
                        return true;
                    }),
                body('name.ar').not().isEmpty().withMessage(() => { return i18n.__('arabicName') })
                    .custom(async (val, { req }) => {
                        let query = { 'name.ar': val, deleted: false };
                        let category = await Category.findOne(query).lean();
                        if (category)
                            throw new Error(i18n.__('arabicNameDublicated'));
                        return true;
                    })
            ];
        }
        else {
            validations = [
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') })
                    .custom(async (val, { req }) => {
                        let query = { 'name.en': val, deleted: false };
                        if (isUpdate)
                            query._id = { $ne: req.params.categoryId };
                        let category = await Category.findOne(query).lean();
                        if (category)
                            throw new Error(i18n.__('englishNameDublicated'));
                        return true;
                    }),
                body('name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('arabicName') })
                    .custom(async (val, { req }) => {
                        let query = { 'name.ar': val, deleted: false };
                        if (isUpdate)
                            query._id = { $ne: req.params.categoryId };
                        let category = await Category.findOne(query).lean();
                        if (category)
                            throw new Error(i18n.__('arabicNameDublicated'));
                        return true;
                    }),
                body('deletedImages').optional().not().isEmpty().withMessage(() => { return i18n.__('deletedImageRequired') }).isArray()
                    .withMessage(() => { return i18n.__('mustBeArray') }),
            ];
        }
        return validations;
    },

    async create(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, i18n.__('unauthrized')));
            let validatedBody = checkValidations(req);
            if (req.files && req.files['image'] && req.files['image'].length > 0) {
                let image = await fieldhandleImg(req, { attributeName: 'image', isUpdate: false }, i18n.__('imageRequired'));
                validatedBody.image = image[0];
            } else {
                return next(new ApiError(400, i18n.__('imageRequired')))
            }
            if (req.files && req.files['slider'] && req.files['slider'].length > 0) {
                let slider = await fieldhandleImg(req, { attributeName: 'slider', isUpdate: false }, i18n.__('imagesRequired'));
                validatedBody.slider = slider;
            } else {
                return next(new ApiError(400, i18n.__('imagesRequired')))
            }
            let createdCategory = await Category.create(validatedBody);
            createdCategory = Category.schema.methods.toJSONLocalizedOnly(createdCategory, i18n.getLocale());
            res.status(200).send(createdCategory);
        } catch (err) {
            next(err);
        }
    },

    validateToSpecificType() {
        return [
            body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') }),
            body('name.ar').not().isEmpty().withMessage(() => { return i18n.__('arabicName') }),
            body('type').not().isEmpty().withMessage(() => { return i18n.__('typeIsRequired') }).isIn(['FIRST_CATEGORY', 'SECOND_CATEGORY', 'THIRD_CATEGORY']).withMessage('error type'),
        ];
    },

    async createToSpecificType(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, ('admin.auth' && user.type != 'SUB_ADMIN')));
            let validatedBody = checkValidations(req);

            if (req.files && req.files['image'] && req.files['image'].length > 0) {
                let image = await fieldhandleImg(req, { attributeName: 'image', isUpdate: false }, i18n.__('imageRequired'));
                validatedBody.image = image[0];
            } else {
                return next(new ApiError(400, i18n.__('imageRequired')))
            }
            if (req.files && req.files['slider'] && req.files['slider'].length > 0) {
                let slider = await fieldhandleImg(req, { attributeName: 'slider', isUpdate: false }, i18n.__('imagesRequired'));
                validatedBody.slider = slider;
            } else {
                return next(new ApiError(400, i18n.__('imagesRequired')))
            }
            let createdCategory = await Category.create(validatedBody);
            createdCategory = Category.schema.methods.toJSONLocalizedOnly(createdCategory, i18n.getLocale());
            res.status(200).send(createdCategory);

            let company = await Company.findOne({ deleted: false });

            if (validatedBody.type == 'FIRST_CATEGORY' && company) {
                company.firstCategory.category = createdCategory.id;
                await company.save();
            }
            else if (validatedBody.type == 'SECOND_CATEGORY' && company) {
                company.secondCategory.category = createdCategory.id;
                await company.save();
            }
            else if (validatedBody.type == 'THIRD_CATEGORY' && company) {
                company.thirdCategory.category = createdCategory.id;
                await company.save();
            }
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { categoryId } = req.params;
            let { removeLanguage } = req.query;
            var category = await checkExistThenGet(categoryId, Category, { deleted: false });
            if (!removeLanguage) {
                category = Category.schema.methods.toJSONLocalizedOnly(category, i18n.getLocale());
            }
            res.status(200).send(category);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, ('admin.auth')));

            let { categoryId } = req.params;
            let { removeLanguage } = req.query;
            let category = await checkExistThenGet(categoryId, Category, { deleted: false });
            let validatedBody = checkValidations(req);
            let newSlider = [];
            if (validatedBody.deletedImages && validatedBody.deletedImages.length > 0) {
                newSlider = category.slider.filter(val => !validatedBody.deletedImages.includes(val));
                deleteImages(validatedBody.deletedImages);
            }

            validatedBody = dotObject.dot(validatedBody);
            if(newSlider.length > 0){
                validatedBody.slider = newSlider;
            }
            if (req.files && req.files['image'] && req.files['image'].length > 0) {
                let image = await fieldhandleImg(req, { attributeName: 'image', isUpdate: false });
                validatedBody.image = image[0];
            }

            if (req.files && req.files['slider'] && req.files['slider'].length > 0) {
                let slider = await fieldhandleImg(req, { attributeName: 'slider', isUpdate: false });
                validatedBody.slider = slider;
            }
            if (req.files['newImages'] && req.files['newImages'].length > 0) {
                let newImages = await fieldhandleImg(req, { attributeName: 'newImages' });
                if (validatedBody.slider)
                    validatedBody.slider = validatedBody.slider.concat(newImages);
                else {
                    validatedBody.slider = category.slider.concat(newImages);
                }
            }
            let updatedCategory = await Category.findByIdAndUpdate(categoryId, validatedBody, { new: true });
            if (!removeLanguage) {
                updatedCategory = Category.schema.methods.toJSONLocalizedOnly(updatedCategory, i18n.getLocale());
            }
            res.status(200).send(updatedCategory);
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

            let { categoryId } = req.params;
            let category = await checkExistThenGet(categoryId, Category, { deleted: false, parent: null });
            category.deleted = true;
            await category.save();
            res.status(200).send('Deleted Successfully');
            if (category.hasChild) {
                await Category.updateMany({ deleted: false, parent: categoryId }, { deleted: true })
            }
            let products = await Product.find({ deleted: false, category: subcategoryId }).distinct('_id');
            await Product.updateMany({ deleted: false, category: categoryId }, { deleted: true })
            await favoritesModel.updateMany({ deleted: false, product: { $in: products } }, { deleted: true })
            await rateModel.updateMany({ deleted: false, product: { $in: products } }, { deleted: true })
            await Size.updateMany({ deleted: false, category: categoryId }, { deleted: true })
            await TradeMark.updateMany({ deleted: false, category: categoryId }, { deleted: true })
        }
        catch (err) {
            next(err);
        }
    },
};