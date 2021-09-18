import User from "../../models/user.model/user.model";
import Product from "../../models/product.model/product.model";
import Favorites from "../../models/favorites.model/favorites.model";
import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { body } from 'express-validator/check';
import { checkValidations } from "../shared.controller/shared.controller";
import i18n from 'i18n';
import countryModel from "../../models/country.model/country.model";

let populateQuery = [
    {
        path: 'product', model: 'product',
        populate: [{ path: 'trader', model: 'user' }, { path: 'productCategory', model: 'productCategory' }]
    },
    {
        path: 'user', model: 'user', populate: [
            { path: 'country', model: 'country' },
            { path: 'city', model: 'city', populate: { path: 'country', model: 'country' } },
            { path: 'region', model: 'region', populate: [{ path: 'city', model: 'city', populate: { path: 'country', model: 'country' } }] }
        ]
    }
];


export default {

    validateBody(isUpdate = false) {
        let validations = [
            body('product').not().isEmpty().withMessage(() => { return i18n.__('productRequired') })
                .custom(async (value) => {
                    await checkExistThenGet(value, Product, { deleted: false })
                })
        ];
        return validations;
    },

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            var { user, product, admin } = req.query;
            let query = { deleted: false };
            if (user) query.user = +user;
            if (product) query.product = +product;
            let aggregateQuery = [
                { $match: query },
                {
                    $lookup: {
                        from: Product.collection.name,
                        localField: "product",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: '$product' },

                { $group: { _id: { trader: '$product.trader' }, favorites: { $push: '$$ROOT' } } },
                {
                    $lookup: {
                        from: User.collection.name,
                        localField: "_id.trader",
                        foreignField: "_id",
                        as: "_id.trader"
                    }
                },
                { $unwind: '$_id.trader' },
                {
                    $lookup: {
                        from: countryModel.collection.name,
                        localField: "_id.trader.country",
                        foreignField: "_id",
                        as: "_id.trader.country"
                    }
                },
                { $unwind: '$_id.country' },
                { $limit: limit },
                { $skip: (page - 1) * limit }
            ]
            let favs = [];
            if (!admin) {
                favs = await Favorites.aggregate(aggregateQuery)
            }
            else {
                favs = await Favorites.find(query)
                    .limit(limit).skip((page - 1) * limit)
                    .sort({ createdAt: -1 }).populate(populateQuery);
            }
            const favCount = await Favorites.count(query);
            const pageCount = Math.ceil(favCount / limit);
            res.send(new ApiResponse(favs, page, pageCount, limit, favCount, req));
        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            let user = req.user;
            let validatedBody = checkValidations(req);
            validatedBody.user = user.id;
            let oldFav = await Favorites.findOne({ ...validatedBody, deleted: false });
            if (oldFav) {
                return next(new ApiError(400, i18n.__('duplicated')));
            }
            let favorite = await Favorites.create(validatedBody);
            favorite = await Favorites.populate(favorite, populateQuery);
            res.status(200).send({ favorite: favorite });
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let { favoriteId } = req.params;
            await checkExist(favoriteId, Favorites, { deleted: false });
            let validatedBody = checkValidations(req);
            let updatedfavorite = await Favorites.findByIdAndUpdate(favoriteId, validatedBody, { new: true });
            res.status(200).send({ favorite: updatedfavorite });
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { favoriteId } = req.params;
            let favorite = await checkExistThenGet(favoriteId, Favorites, { deleted: false, populate: populateQuery });
            res.status(200).send({ favorite: favorite });

        } catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let query = { deleted: false, product: req.body.product, user: req.user.id }
            let favorite = await Favorites.findOne(query);
            if (!favorite) {
                return next(new ApiError(404, i18n.__('NotFound')));
            }
            favorite.deleted = true;
            await favorite.save();
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    }
}