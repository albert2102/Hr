import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExist, checkExistThenGet } from "../../helpers/CheckMethods";
import { checkValidations, fieldhandleImg, handleImg, deleteImages } from "../shared.controller/shared.controller";
import { body } from "express-validator/check";
import TradeMark from "../../models/tradeMark.model/tradeMark.model";
import Product from "../../models/product.model/product.model";
import Category from "../../models/category.model/category.model";
import Favorites from '../../models/favorites.model/favorites.model';
import Region from "../../models/region.model/region.model";
import Country from "../../models/country.model/country.model";
import City from "../../models/city.model/city.model";
import Company from "../../models/company.model/company.model";
import Subscription from '../../models/subscription.model/subscription.model';
import Order from '../../models/order.model/order.model';
import Rate from "../../models/rate.model/rate.model";
import User from "../../models/user.model/user.model";
import i18n from 'i18n'
import moment from 'moment'
import dotObject from 'dot-object';
import Color from '../../models/color.model/color.model';
import Size from '../../models/size.model/size.model';
import { sendEmail } from '../../services/emailMessage.service'

let populateQuery = [
    { path: 'trader', model: 'user' },
    { path: 'productCategory', model: 'productCategory' }
];

let sendToSubscriptions = async (product) => { // twilio
    try {
        let text = 'تم اضافة خصم على هذا منتج ' + product.name.ar + ' ' + 'يمكنك الاستمتاع بهذا الخصم الان '
        let subscriptions = await Subscription.find({ deleted: false });
        for (let index = 0; index < subscriptions.length; index++) {
            if (subscriptions[index].email) {
                await sendEmail(subscriptions[index].email, text)
            }
            // add if phone twilio
        }
    } catch (error) {
        throw error;
    }
}

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

let getProducts = async (list) => {
    try {
        let promises = [];
        let result = [];
        for (let index = 0; index < list.length; index++) {
            let aggregateQuery = [{ $match: { deleted: false, 'products.product': +list[index], status: 'DELIVERED' } },
            { $group: { _id: { product: '$products' } } },
            { $unwind: '$_id.product' },
            { $match: { '_id.product.product': +list[index] } },
            { $group: { _id: "$_id.product.product", totalQuantity: { $sum: "$_id.product.quantity" }, totalPrice: { $sum: { $multiply: ["$_id.product.quantity", "$_id.product.priceAfterOffer"] } } } },
            { $sort: { "totalQuantity": -1 } },
            {
                $lookup: {
                    from: Product.collection.name,
                    localField: "_id",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: '$product' },
            ]

            promises.push(createPromise(Order.aggregate(aggregateQuery)));
        }
        let finalResult = await Promise.all(promises);
        for (let index = 0; index < finalResult.length; index++) {
            if (finalResult[index].length > 0) {
                delete finalResult[index][0]._id;
                result.push(finalResult[index][0].product._id)
            }
        }

        return result;
    } catch (error) {
        throw error;
    }

}
export default {

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let { name, unit, description, price, offer, hasOffer,
                quantity, rate, month, year, category, tradeMark, color, size, allSizes,
                sortByPrice, userId, country, city, region, similar, type, categoryProducts, removeLanguage,
                fromPrice, toPrice, topSelling, lastProducts, lastOffers, useStatus, serialNumber, all
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
            if (hasOffer) query.offer = { $gt: 0 };
            if (quantity) query.quantity = quantity;
            if (rate) query.rate = rate;
            if (offer) query.offer = offer;
            if (price) query.price = price;
            if (country) query.countrys = country;
            if (city) query.cities = city;
            if (region) query.regions = region;
            if (useStatus) query.useStatus = useStatus;

            if (hasOffer) query.offer = { $gt: 0 };

            if (categoryProducts) {
                let subIds = await Category.find({ deleted: false, parent: categoryProducts }).distinct('_id');
                query.$or = [{ category: categoryProducts }, { category: { $in: subIds } }];
            }


            if (tradeMark) {
                if (Array.isArray(tradeMark)) {
                    query.tradeMark = { $in: tradeMark };
                } else if (!isNaN(tradeMark)) {
                    query.tradeMark = tradeMark;
                }
            }
            if (category) {
                if (Array.isArray(category)) {
                    query.category = { $in: category };
                } else if (!isNaN(category)) {
                    query.category = category;
                }
            }
            if (color) {
                if (Array.isArray(color)) {
                    query['colors.color'] = { $in: color };
                } else if (!isNaN(color)) {
                    query['colors.color'] = color;
                }
            }
            if (size) {
                if (Array.isArray(size)) {
                    query['colors.sizes.size'] = { $in: size };
                } else if (!isNaN(size)) {
                    query['colors.sizes.size'] = size;
                }
            }
            if (allSizes) {
                let sizes = await Size.find({ deleted: false }).distinct('_id');
                query['colors.sizes.size'] = { $in: sizes };
            }

            if (name) {
                query.$or = [{ 'name.en': { '$regex': name, '$options': 'i' } }, { 'name.ar': { '$regex': name, '$options': 'i' } }]
            }
            if (unit) {
                query.$or = [{ 'unit.en': { '$regex': unit, '$options': 'i' } }, { 'unit.ar': { '$regex': unit, '$options': 'i' } }]
            }
            if (description) {
                query.$or = [{ 'description.en': { '$regex': description, '$options': 'i' } }, { 'description.ar': { '$regex': description, '$options': 'i' } }]
            }

            if (similar) {
                let product = await checkExistThenGet(similar, Product, { deleted: false });
                query.$or = [{ category: product.category, tradeMark: product.tradeMark }];
                query._id = { $ne: similar }
            }
            if (topSelling) {
                let topSellingProducts = await getProducts(await Product.find({ deleted: false }).distinct('_id'));
                if (topSellingProducts.length > 0) {
                    query._id = { $in: topSellingProducts }
                } else {
                    sortQuery = { _id: 1 }
                }
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
                body('taxes').optional().not().isEmpty().withMessage(() => { return i18n.__('taxesRequired') }).isInt({ min: 0, max: 100 }),
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
                body('description.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('descriptionRequired') })
            ];
        }
        else {
            validations = [
                
                body('price').optional().not().isEmpty().withMessage(() => { return i18n.__('priceRequired') }),
                body('taxes').optional().not().isEmpty().withMessage(() => { return i18n.__('taxesRequired') })
                    .isInt({ min: 0, max: 100 }),
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

                
                body('deletedImages').optional().not().isEmpty().withMessage(() => { return i18n.__('deletedImageRequired') }).isArray()
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
            let product = await checkExistThenGet(productId, Product, { deleted: false ,trader:user.id});
            var validatedBody = checkValidations(req);
            
            if (validatedBody.name && !(validatedBody.name.en || validatedBody.name.ar)) {
                return next(new ApiError(404, i18n.__('nameRequired')));
            }
            
            if (validatedBody.description && !(validatedBody.description.en || validatedBody.description.ar)) {
                return next(new ApiError(404, i18n.__('descriptionRequired')));
            }

            let newSlider = [];
            if (validatedBody.deletedImages && validatedBody.deletedImages.length > 0) {
                newSlider = product.slider.filter(val => !validatedBody.deletedImages.includes(val));
                deleteImages(validatedBody.deletedImages);
            }
            let data = {}
            
            validatedBody = dotObject.dot(validatedBody);
            if (newSlider.length > 0) {
                validatedBody.slider = newSlider;
            }

            if (req.files && req.files['image']) {
                validatedBody.image = fieldhandleImg(req, { attributeName: 'image', isUpdate: false });
            }
            if (req.files && req.files['slider']) {
                validatedBody.slider = fieldhandleImg(req, { attributeName: 'slider', isUpdate: false });
            }

            if (req.files['newImages'] && req.files['newImages'].length > 0) {
                let newImages = await fieldhandleImg(req, { attributeName: 'newImages' });
                if (validatedBody.slider)
                    validatedBody.slider = validatedBody.slider.concat(newImages);
                else {
                    validatedBody.slider = product.slider.concat(newImages);
                }
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
            let product = await checkExistThenGet(productId, Product, { deleted: false ,trader:user.id});
            product.deleted = true;
            await product.save();
            res.status(200).send('Deleted Successfully');
            await Rate.updateMany({ product: productId, deleted: false }, { deleted: true });
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