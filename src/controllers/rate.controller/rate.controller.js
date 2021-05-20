import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import Rate from "../../models/rate.model/rate.model";
import User from "../../models/user.model/user.model";
import { checkExist, checkExistThenGet } from "../../helpers/CheckMethods";
import { checkValidations } from "../shared.controller/shared.controller";
import { body } from "express-validator/check";
import i18n from 'i18n'

let popQuery = [
    { path: 'user', model: 'user' },
    { path: 'trader', model: 'user' },
]

export default {

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1,
                limit = +req.query.limit || 20;
            let {user, trader, all } = req.query;
            let query = { deleted: false };
            
            if (user) query.user = user;
            let rate
            if (all) {
                rate = await Rate.find(query).populate(popQuery)
                    .sort({ createdAt: -1 })
            } else {
                rate = await Rate.find(query).populate(popQuery)
                    .sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit)
            }

            let rateCount;
            if (all) {
                rateCount = rate.length
            } else {
                rateCount = await Rate.count(query);
            }
            const pageCount = Math.ceil(rateCount / limit);

            res.send(new ApiResponse(rate, page, pageCount, limit, rateCount, req));
        } catch (err) {
            next(err);
        }
    },

    validateBody(isUpdate = false) {
        let validations = [
            body('rate').not().isEmpty().withMessage(() => { return i18n.__('rateRequired') })
                .isInt({ min: 1, max: 5 }).withMessage(() => { return i18n.__('rateRange') }),
            body('trader').optional().not().isEmpty().withMessage(() => { return i18n.__('traderRequired') }),
            body('comment').optional().not().isEmpty().withMessage(() => { return i18n.__('commentRequired') })

        ];
        return validations;
    },

    async create(req, res, next) {
        try {
            const validatedBody = checkValidations(req);
            let trader = await checkExistThenGet(validatedBody.trader, User, { deleted: false });
            validatedBody.user = req.user.id
            let createdrate;
            let oldRate = await Rate.findOne({
                deleted: false,
                user: validatedBody.user,
                trader: validatedBody.trader
            })
            if (oldRate) {
                oldRate.rate = validatedBody.rate;
                if (validatedBody.comment) oldRate.comment = validatedBody.comment;
                await oldRate.save();
                createdrate = oldRate;
            } else {
                createdrate = await Rate.create(validatedBody);

            }

            let matchQuery = { $and: [{ deleted: false }, { trader: +trader.id }] }
            let query = [{ $match: matchQuery },
            { $group: { _id: null, totalrate: { $sum: "$rate" }, count: { $sum: 1 } } }
            ]
            var rate = await Rate.aggregate(query);
            let totalRate = 0;
            if (rate.length > 0) {
                totalRate = Math.ceil(rate[0].totalrate / rate[0].count);
            }
            trader.rate = totalRate;
            await trader.save()
            createdrate = await Rate.populate(createdrate, popQuery)

            res.status(201).send({ createdrate });

        } catch (err) {
            next(err);
        }
    },

    validateDriverBody(isUpdate = false) {
        let validations = [
            body('rate').not().isEmpty().withMessage(() => { return i18n.__('rateRequired') })
                .isInt({ min: 1, max: 5 }).withMessage(() => { return i18n.__('rateRange') }),
            body('driver').not().isEmpty().withMessage(() => { return i18n.__('driverRequired') }),
            body('comment').optional().not().isEmpty().withMessage(() => { return i18n.__('commentRequired') })
        ];
        return validations;
    },

    async createDriverRate(req, res, next) {
        try {
            const validatedBody = checkValidations(req);
            let driver = await checkExistThenGet(validatedBody.driver, Driver, { deleted: false });
            validatedBody.user = req.user.id;
            let createdrate;
            let oldRate = await Rate.findOne({
                deleted: false,
                user: validatedBody.user,
                driver: validatedBody.driver
            })
            if (oldRate) {
                oldRate.rate = validatedBody.rate;
                if (validatedBody.comment) oldRate.comment = validatedBody.comment;
                await oldRate.save();
                createdrate = oldRate;
            } else {
                createdrate = await Rate.create(validatedBody);
            }
            let matchQuery = { $and: [{ deleted: false }, { driver: +driver.id }] }
            let query = [{ $match: matchQuery },
            { $group: { _id: null, totalrate: { $sum: "$rate" }, count: { $sum: 1 } } }
            ]
            var rate = await Rate.aggregate(query);

            let totalRate = 0;
            if (rate.length > 0) {
                totalRate = Math.ceil(rate[0].totalrate / rate[0].count);
            }
            driver.rate = totalRate;
            await driver.save();

            createdrate = await Rate.populate(createdrate, popQuery)

            res.status(201).send({ createdrate });


        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { rateId } = req.params;
            let rate = await checkExistThenGet(rateId, Rate, { deleted: false, populate: popQuery });
            res.status(200).send(rate);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {

        try {
            let { rateId } = req.params;
            await checkExist(rateId, Rate, { deleted: false });
            const validatedBody = checkValidations(req);
            let updatedrate = await Rate.findByIdAndUpdate(rateId, validatedBody, { new: true })
                .populate(popQuery);
            res.status(200).send(updatedrate);
        } catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let { rateId } = req.params;
            let rate = await checkExistThenGet(rateId, Rate, { deleted: false });
            rate.deleted = true;
            await rate.save();
            res.status(204).send('delete success');
        } catch (err) {
            next(err);
        }
    },
};