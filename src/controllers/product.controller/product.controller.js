import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExist, checkExistThenGet } from "../../helpers/CheckMethods";
import { checkValidations, fieldhandleImg, handleImg, deleteImages } from "../shared.controller/shared.controller";
import { body } from "express-validator/check";
import Product from "../../models/product.model/product.model";
import Category from "../../models/product-category.model/product-category.model";
import Favorites from '../../models/favorites.model/favorites.model';
import i18n from 'i18n'
import moment from 'moment'
import dotObject from 'dot-object';


let populateQuery = [
    { path: 'trader', model: 'user' },
    { path: 'productCategory', model: 'productCategory' }
];



let createPromise = (query) => {
    let newPromise = new Promise(async (resolve, reject) => {
        try {
            const result = await query;
            resolve(result);
        } catch (error) {
            reject(error);
        }
    })
    return newPromise;
}

let checkinFavorites = async (list, userId) => {
    try {
        let promises = [];
        let query = { deleted: false, user: userId }
        for (let index = 0; index < list.length; index++) {
            query.product = list[index].id;
            let promis = Favorites.findOne(query);
            if (promis)
                promises.push(createPromise(promis));
        }
        let finalResult = await Promise.all(promises);
        for (let index = 0; index < finalResult.length; index++) {
            if (finalResult[index]) {
                list[index].favorite = true;
            } else {
                list[index].favorite = false;
            }
        }
        return list;
    } catch (error) {
        throw error;
    }

}


export default {

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let { name, description, price, offer, hasOffer,
                quantity, month, year,
                sortByPrice, userId, type, removeLanguage,
                fromPrice, toPrice, lastProducts, lastOffers, useStatus, serialNumber, all, productCategory
            } = req.query;
            let query = { deleted: false };
            let sortQuery = { _id: -1 };
            if (serialNumber) query.serialNumber = serialNumber;



            if (fromPrice && toPrice) {
                query.price = { $gte: fromPrice, $lte: toPrice }
            } else if (fromPrice) {
                query.price = { $gte: fromPrice }
            } else if (toPrice) {
                query.price = { $lte: toPrice }
            }

            if (type) query.type = type;
            if (productCategory) query.productCategory = productCategory;
            if (hasOffer) query.offer = { $gt: 0 };
            if (quantity) query.quantity = quantity;
            if (offer) query.offer = offer;
            if (price) query.price = price;

            if (useStatus) query.useStatus = useStatus;

            if (hasOffer) query.offer = { $gt: 0 };

            if (name) {
                query.$or = [{ 'name.en': { '$regex': name, '$options': 'i' } }, { 'name.ar': { '$regex': name, '$options': 'i' } }]
            }

            if (description) {
                query.$or = [{ 'description.en': { '$regex': description, '$options': 'i' } }, { 'description.ar': { '$regex': description, '$options': 'i' } }]
            }



            if (lastProducts) {
                sortQuery = { _id: -1 }
            }
            if (lastOffers) {
                query.offer = { $gt: 0 }
            }
            if (sortByPrice) {
                sortQuery = { priceAfterOffer: sortByPrice }
            }
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
            const productCount = await Product.count(query);
            let pageCount = Math.ceil(productCount / limit);
            let product;
            if (all) {
                limit = productCount;
                pageCount = 1;
                product = await Product.find(query).sort(sortQuery).populate(populateQuery)

            } else {
                product = await Product.find(query).sort(sortQuery).limit(limit).skip((page - 1) * limit).populate(populateQuery)
            }
            if (userId) product = await checkinFavorites(product, userId);

            if (!removeLanguage) {
                product = Product.schema.methods.toJSONLocalizedOnly(product, i18n.getLocale());
            }


            res.send(new ApiResponse(product, page, pageCount, limit, productCount, req));
        } catch (err) {
            next(err);
        }
    },

    validateBody(isUpdate = false) {
        let validations = [];
        if (!isUpdate) {
            validations = [
                body('price').not().isEmpty().withMessage(() => { return i18n.__('priceRequired') }),
                //body('taxes').optional().not().isEmpty().withMessage(() => { return i18n.__('taxesRequired') }).isInt({ min: 0, max: 100 }),
                body('offer').optional().not().isEmpty().withMessage(() => { return i18n.__('offerRequired') })
                    .isInt({ max: 100, min: 0 }).withMessage(() => { return i18n.__('invalidOfferValue') }),

                body('productCategory').not().isEmpty().withMessage(() => { return i18n.__('productCategoryRequired') })
                    .custom(async (value) => {
                        await checkExist(value, Category, { deleted: false });
                        return true;
                    }),
                body('name').not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') }),
                body('name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('arabicName') }),

                body('description').not().isEmpty().withMessage(() => { return i18n.__('descriptionRequired') }),
                body('description.en').optional().not().isEmpty().withMessage(() => { return i18n.__('descriptionRequired') }),
                body('description.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('descriptionRequired') }),

                body('slider').not().isEmpty().withMessage(() => { return i18n.__('sliderRequired') }).isArray()
                    .withMessage(() => { return i18n.__('mustBeArray') }),
            ];
        }
        else {
            validations = [

                body('price').optional().not().isEmpty().withMessage(() => { return i18n.__('priceRequired') }),
                //body('taxes').optional().not().isEmpty().withMessage(() => { return i18n.__('taxesRequired') }).isInt({ min: 0, max: 100 }),
                body('offer').optional().not().isEmpty().withMessage(() => { return i18n.__('offerRequired') })
                    .isInt({ max: 100, min: 0 }).withMessage(() => { return i18n.__('invalidOfferValue') }),
                body('productCategory').optional().not().isEmpty().withMessage(() => { return i18n.__('productCategoryRequired') })
                    .custom(async (value) => {
                        await checkExist(value, Category, { deleted: false });
                        return true;
                    }),



                body('name').optional().not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
                body('name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('englishName') }),
                body('name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('arabicName') }),

                body('description').optional().not().isEmpty().withMessage(() => { return i18n.__('descriptionRequired') }),
                body('description.en').optional().not().isEmpty().withMessage(() => { return i18n.__('descriptionRequired') }),
                body('description.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('descriptionRequired') }),

                body('slider').optional().not().isEmpty().withMessage(() => { return i18n.__('sliderRequired') }).isArray()
                    .withMessage(() => { return i18n.__('mustBeArray') }),
            ];
        }
        return validations;
    },

    async create(req, res, next) {
        try {
            let user = req.user;

            const validatedBody = checkValidations(req);
            validatedBody.trader = user.id;

            if (!(validatedBody.name.en || validatedBody.name.ar)) {
                return next(new ApiError(404, i18n.__('nameRequired')));
            }

            if (!(validatedBody.description.en || validatedBody.description.ar)) {
                return next(new ApiError(404, i18n.__('descriptionRequired')));
            }
            if (req.files && req.files['image'] && (req.files['image'].length > 0)) {
                validatedBody.image = fieldhandleImg(req, { attributeName: 'image', isUpdate: false });
            }
            if (req.files && req.files['slider'] && (req.files['slider'].length > 0)) {
                validatedBody.slider = fieldhandleImg(req, { attributeName: 'slider', isUpdate: false });
            }


            let createdproduct = await Product.create(validatedBody);
            createdproduct = Product.schema.methods.toJSONLocalizedOnly(createdproduct, i18n.getLocale());
            res.status(200).send(createdproduct);
        } catch (err) {
            next(err);
        }
    },



    async findById(req, res, next) {
        try {
            let { productId } = req.params;
            let { removeLanguage, userId } = req.query;
            let product = await checkExistThenGet(productId, Product, { deleted: false, populate: populateQuery });
            if (userId) product = await checkinFavorites([product], userId);

            if (!removeLanguage) {
                product = Product.schema.methods.toJSONLocalizedOnly(product, i18n.getLocale());
            }
            res.status(200).send(product);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let user = req.user;
            let { productId } = req.params;
            let { removeLanguage } = req.query;
            let product = await checkExistThenGet(productId, Product, { deleted: false, trader: user.id });
            var validatedBody = checkValidations(req);

            if (validatedBody.name && !(validatedBody.name.en || validatedBody.name.ar)) {
                return next(new ApiError(404, i18n.__('nameRequired')));
            }

            if (validatedBody.description && !(validatedBody.description.en || validatedBody.description.ar)) {
                return next(new ApiError(404, i18n.__('descriptionRequired')));
            }

            let data = {};
            if(validatedBody.slider){
                data.slider = validatedBody.slider;
                delete validatedBody.slider;
            }
            validatedBody = dotObject.dot(validatedBody);

            if (req.files && req.files['image']) {
                validatedBody.image = fieldhandleImg(req, { attributeName: 'image', isUpdate: false });
            }
            if (req.files && req.files['slider']) {
                validatedBody.slider = fieldhandleImg(req, { attributeName: 'slider', isUpdate: false });
            }

            let updatedproduct = await Product.findByIdAndUpdate(productId, { ...validatedBody, ...data }, { new: true }).populate(populateQuery)
            if (!removeLanguage) {
                updatedproduct = Product.schema.methods.toJSONLocalizedOnly(updatedproduct, i18n.getLocale());
            }
            res.status(200).send(updatedproduct);
        }
        catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let user = req.user;
            let { productId } = req.params;
            let product = await checkExistThenGet(productId, Product, { deleted: false, trader: user.id });
            product.deleted = true;
            await product.save();
            res.status(200).send('Deleted Successfully');
            await Favorites.updateMany({ product: productId, deleted: false }, { deleted: true });
        }
        catch (err) {
            next(err);
        }
    },

    async uploadImage(req, res, next) {
        try {
            let productImage = await handleImg(req, { attributeName: 'image', isUpdate: false });
            res.status(200).send({ link: productImage });
        } catch (error) {
            next(error);
        }
    },
};