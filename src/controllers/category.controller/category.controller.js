import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExist, checkExistThenGet } from "../../helpers/CheckMethods";
import { checkValidations, handleImg } from "../shared.controller/shared.controller";
import { body } from "express-validator/check";
import Category from "../../models/category.model/category.model";
import Company from "../../models/company.model/company.model";
import i18n from 'i18n'
import dotObject from 'dot-object';
import moment from 'moment'
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
            if (req.file) {
                let icon = await handleImg(req, { attributeName: 'icon', isUpdate: false }, i18n.__('iconRequired'));
                validatedBody.icon = icon;
            } else {
                return next(new ApiError(400, i18n.__('iconRequired')))
            }
            let createdCategory = await Category.create(validatedBody);
            createdCategory = Category.schema.methods.toJSONLocalizedOnly(createdCategory, i18n.getLocale());
            res.status(200).send(createdCategory);
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
            
            validatedBody = dotObject.dot(validatedBody);
           
            if (req.file) {
                let icon = await handleImg(req, { attributeName: 'icon', isUpdate: false });
                validatedBody.icon = icon;
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
        }
        catch (err) {
            next(err);
        }
    },
};