import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import {  checkExistThenGet } from "../../helpers/CheckMethods";
import { checkValidations, handleImg } from "../shared.controller/shared.controller";
import { body } from "express-validator/check";
import ProductCategory from "../../models/product-category.model/product-category.model";
import i18n from 'i18n'
import dotObject from 'dot-object';
import moment from 'moment';

const populateQuery = [
    {path:'user',model:'user'}
]
export default {

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let { name, month, year, all,type , removeLanguage ,user} = req.query
            let query = { deleted: false };
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
            if (user) {
                query.user = user;
            }
            if (year && !month) {
                date.setFullYear(year);
                let startOfDate = moment(date).startOf('year');
                let endOfDate = moment(date).endOf('year');
                query.createdAt = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) }
            }
            
            let categories,categoriesCount;
            let pageCount = categoriesCount;
            if (all) {
                limit = pageCount;
                categories = await ProductCategory.find(query).sort({ createdAt: -1 }).populate(populateQuery)
                categoriesCount = categories.length;
            }
            else {
                categoriesCount = await ProductCategory.count(query);
                pageCount = Math.ceil(categoriesCount / limit);
                categories = await ProductCategory.find(query).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit).populate(populateQuery)
            }
            if (!removeLanguage) {
                categories = ProductCategory.schema.methods.toJSONLocalizedOnly(categories, i18n.getLocale());
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
                        let query = { 'name.en': val, deleted: false , user:req.user.id};
                        let productCategory = await ProductCategory.findOne(query).lean();
                        if (productCategory)
                            throw new Error(i18n.__('englishNameDublicated'));
                        return true;
                    }),
                body('name.ar').not().isEmpty().withMessage(() => { return i18n.__('arabicName') })
                    .custom(async (val, { req }) => {
                        let query = { 'name.ar': val, deleted: false , user:req.user.id};
                        let productCategory = await ProductCategory.findOne(query).lean();
                        if (productCategory)
                            throw new Error(i18n.__('arabicNameDublicated'));
                        return true;
                    })
            ];
        }
        else {
            validations = [
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') })
                    .custom(async (val, { req }) => {
                        let query = { 'name.en': val, deleted: false , user:req.user.id};
                        
                        query._id = { $ne: req.params.productCategoryId };
                        let productCategory = await ProductCategory.findOne(query).lean();
                        if (productCategory)
                            throw new Error(i18n.__('englishNameDublicated'));
                        return true;
                    }),
                body('name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('arabicName') })
                    .custom(async (val, { req }) => {
                        let query = { 'name.ar': val, deleted: false, user:req.user.id };
                       
                        query._id = { $ne: req.params.productCategoryId };
                        let productCategory = await ProductCategory.findOne(query).lean();
                        if (productCategory)
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
            let validatedBody = checkValidations(req);
            validatedBody.user = user.id;
            // if (req.file) {
            //     let icon = await handleImg(req, { attributeName: 'icon', isUpdate: false }, i18n.__('iconRequired'));
            //     validatedBody.icon = icon;
            // } else {
            //     return next(new ApiError(400, i18n.__('iconRequired')))
            // }
            let createdproductCategory = await ProductCategory.create(validatedBody);
            createdproductCategory = ProductCategory.schema.methods.toJSONLocalizedOnly(createdproductCategory, i18n.getLocale());
            res.status(200).send({category : createdproductCategory});
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { productCategoryId } = req.params;
            let { removeLanguage } = req.query;
            var productCategory = await checkExistThenGet(productCategoryId, ProductCategory, { deleted: false,populate:populateQuery });
            if (!removeLanguage) {
                productCategory = ProductCategory.schema.methods.toJSONLocalizedOnly(productCategory, i18n.getLocale());
            }
            res.status(200).send({category : productCategory});
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let user = req.user;
            let { productCategoryId } = req.params;
            let { removeLanguage } = req.query;
            let productCategory = await checkExistThenGet(productCategoryId, ProductCategory, { deleted: false , user:user.id});
            let validatedBody = checkValidations(req);
            
            validatedBody = dotObject.dot(validatedBody);
           
            // if (req.file) {
            //     let icon = await handleImg(req, { attributeName: 'icon', isUpdate: false });
            //     validatedBody.icon = icon;
            // }

            let updatedproductCategory = await ProductCategory.findByIdAndUpdate(productCategoryId, validatedBody, { new: true }).populate(populateQuery)
            if (!removeLanguage) {
                updatedproductCategory = ProductCategory.schema.methods.toJSONLocalizedOnly(updatedproductCategory, i18n.getLocale());
            }
            res.status(200).send(updatedproductCategory);
        }
        catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let user = req.user;
            let { productCategoryId } = req.params;
            let productCategory = await checkExistThenGet(productCategoryId, ProductCategory, { deleted: false, user:user.id });
            productCategory.deleted = true;
            await productCategory.save();
            res.status(200).send('Deleted Successfully');
        }
        catch (err) {
            next(err);
        }
    },
};