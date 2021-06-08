import RequestMoney from "../../models/requestMoneyHistory.model/requestMoneyHistory.model";
import User from "../../models/user.model/user.model";
import Order from "../../models/order.model/order.model";
import ApiResponse from "../../helpers/ApiResponse";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { body } from 'express-validator/check';
import { checkValidations } from "../shared.controller/shared.controller";
import i18n from 'i18n';
import moment from 'moment'
import ApiError from "../../helpers/ApiError";
import { generateVerifyCode } from '../../services/generator-code-service'
import socketEvents from '../../socketEvents';
import notifyController from '../notif.controller/notif.controller';

let populateQuery = [
    { path: 'driver', model: 'user' },
    { path: 'trader', model: 'user' },
    { path: 'payedBy', model: 'user' },
    { path: 'orders', model: 'order' },
];


export default {

    validateBody(isUpdate = false) {
        let validations
        if (!isUpdate) {
            validations = [
                body('orders').not().isEmpty().withMessage(() => { return i18n.__('ordersRequired') }),
                body('orders.*').not().isEmpty().withMessage(() => { return i18n.__('orderRequired') })
                    .custom(async (value) => {
                        await checkExist(value, Order, { deleted: false,status: 'DELIVERED' });
                    })
            ];
        }
        return validations;
    },

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            var { driver, trader, payedDate, month, year, order } = req.query;
            let query = { deleted: false };

            if (driver) query.driver = driver;
            if (trader) query.trader = trader;
            if (order) query.orders = order;
            if (payedDate) {
                let startOfDate = moment(date).startOf('day');
                let endOfDate = moment(date).endOf('day');
                query.payedDate = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) }
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

            let data = await RequestMoney.find(query).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit).populate(populateQuery)
            const dataCount = await RequestMoney.count(query);
            let pageCount = Math.ceil(dataCount / limit);
            data = RequestMoney.schema.methods.toJSONLocalizedOnly(data, i18n.getLocale());

            res.send(new ApiResponse(data, page, pageCount, limit, dataCount, req));

        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            let validatedBody = checkValidations(req);

            let user = req.user;
            if (user.type == 'DRIVER') {
                validatedBody.driver = user.id;
            } else if (user.type == 'INSTITUTION') {
                validatedBody.trader = user.id;
            } else {
                return next(new ApiError(403, i18n.__('unauthrized')));
            }

            let requestMoney = await RequestMoney.create(validatedBody);

            requestMoney = await RequestMoney.populate(requestMoney, populateQuery);
            requestMoney = RequestMoney.schema.methods.toJSONLocalizedOnly(requestMoney, i18n.getLocale());
            res.status(200).send(requestMoney);
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { requestMoneyId } = req.params;
            let requestMoney = await checkExistThenGet(requestMoneyId, RequestMoney, { deleted: false, populate: populateQuery });

            requestMoney = RequestMoney.schema.methods.toJSONLocalizedOnly(requestMoney, i18n.getLocale());

            res.status(200).send(requestMoney);

        } catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, i18n.__('unauthrized')));

            let { requestMoneyId } = req.params;
            let requestMoney = await checkExistThenGet(requestMoneyId, RequestMoney, { deleted: false });
            requestMoney.deleted = true;
            await requestMoney.save();
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    },

    ////////////////////////////////////////////////////////////////////////////
    async payedOrders(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, i18n.__('unauthrized')));

            let { requestMoneyId } = req.params;
            let requestMoney = await checkExistThenGet(requestMoneyId, RequestMoney, { deleted: false });
            requestMoney.payedBy = user.id
            requestMoney.payedDate = new Date();
            await requestMoney.save();
            if (requestMoney.driver) {
                await Order.updateMany({ _id: { $in: requestMoney.orders } }, {driverPayoffDues:true,driverPayoffDuesDate:new Date()})

            }else {
                await Order.updateMany({ _id: { $in: requestMoney.orders } }, {traderPayoffDues:true,traderPayoffDuesDate:new Date()})
            }
            res.status(200).send("Done");

        } catch (err) {
            next(err);
        }
    },
}