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

let countNew = async () => {
    try {
        let count = await RequestMoney.count({ deleted: false, payedBy: null });
        adminNSP.emit(socketEvents.RequestMoneyCount, { count: count });
    } catch (error) {
        throw error;
    }
}
export default {

    validateBody(isUpdate = false) {
        let validations
        if (!isUpdate) {
            validations = [
                body('orders').not().isEmpty().withMessage(() => { return i18n.__('ordersRequired') }),
                body('orders.*').not().isEmpty().withMessage(() => { return i18n.__('orderRequired') })
                    .custom(async (value) => {
                        await checkExist(value, Order, { deleted: false, status: 'DELIVERED' });
                    })
            ];
        }
        return validations;
    },

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            var { driver, trader, payedDate, month, year, order,name,email,phone,type } = req.query;
            let query = { deleted: false };

            if(type && type == 'DRIVER') query.driver = {$ne: null};
            if(type && type == 'TRADER') query.trader = {$ne: null};
            if (driver) query.driver = driver;
            if (trader) query.trader = trader;
            if (order) query.orders = order;
            if (payedDate) {
                let startOfDate = moment(date).startOf('day');
                let endOfDate = moment(date).endOf('day');
                query.payedDate = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) }
            }
            let usersId
            if(name){
                usersId = await User.find({deleted: false,name:{ '$regex': name, '$options': 'i' }}).distinct('_id');
                query.$or = [{driver:{$in:usersId}},{trader:{$in:usersId}}]
            }
            if(phone){
                usersId = await User.find({deleted: false,phone:{ '$regex': phone, '$options': 'i' }}).distinct('_id');
                query.$or = [{driver:{$in:usersId}},{trader:{$in:usersId}}]
            }
            if(email){
                usersId = await User.find({deleted: false,email:{ '$regex': email, '$options': 'i' }}).distinct('_id');
                query.$or = [{driver:{$in:usersId}},{trader:{$in:usersId}}]
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
            await countNew();
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
            let description = { ar: ' تم تحول فلوسك المطلوبة , لو في اى استفسار تواصل مع الدعم ', en: 'Your requested money has been transferred, if you have any questions, contact support' };

            if (requestMoney.driver) {
                await Order.updateMany({ _id: { $in: requestMoney.orders } }, { driverPayoffDues: true, driverPayoffDuesDate: new Date() })

                await notifyController.create(req.user.id, requestMoney.driver, description, requestMoney.id, 'TRANSFER_MONEY');
                notifyController.pushNotification(requestMoney.driver, 'TRANSFER_MONEY', requestMoney.id, description);
            } else {
                await Order.updateMany({ _id: { $in: requestMoney.orders } }, { traderPayoffDues: true, traderPayoffDuesDate: new Date() })

                await notifyController.create(req.user.id, requestMoney.trader, description, requestMoney.id, 'TRANSFER_MONEY');
                notifyController.pushNotification(requestMoney.trader, 'TRANSFER_MONEY', requestMoney.id, description);
            }
            res.status(200).send("Done");
            await countNew();
        } catch (err) {
            next(err);
        }
    },
    countNew,

    /////////////////////////////////////////////////////////////////////////////
    AdminPayedForTrader(isUpdate = false) {
        let validations
        if (!isUpdate) {
            validations = [
                body('orders').not().isEmpty().withMessage(() => { return i18n.__('ordersRequired') }),
                body('orders.*').not().isEmpty().withMessage(() => { return i18n.__('orderRequired') })
                    .custom(async (value) => {
                        await checkExist(value, Order, { deleted: false, status: 'DELIVERED' });
                    }),
                body('trader').not().isEmpty().withMessage(() => { return i18n.__('traderRequired') })
                    .custom(async (value) => {
                        await checkExist(value, User, { deleted: false, type: 'INSTITUTION' });
                    })

            ];
        }
        return validations;
    },
    AdminPayedForDriver(isUpdate = false) {
        let validations
        if (!isUpdate) {
            validations = [
                body('orders').not().isEmpty().withMessage(() => { return i18n.__('ordersRequired') }),
                body('orders.*').not().isEmpty().withMessage(() => { return i18n.__('orderRequired') })
                    .custom(async (value) => {
                        await checkExist(value, Order, { deleted: false, status: 'DELIVERED' });
                    }),
                body('driver').not().isEmpty().withMessage(() => { return i18n.__('driverRequired') })
                    .custom(async (value) => {
                        await checkExist(value, User, { deleted: false, type: 'DRIVER' });
                    })
            ];
        }
        return validations;
    },
    async AdminPayedOrders(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, i18n.__('unauthrized')));

            let validatedBody = checkValidations(req);

            let description = { ar: ' تم تحول فلوسك المطلوبة , لو في اى استفسار تواصل مع الدعم ', en: 'Your requested money has been transferred, if you have any questions, contact support' };

            if (validatedBody.driver) {
                await Order.updateMany({ _id: { $in: validatedBody.orders } }, { driverPayoffDues: true, driverPayoffDuesDate: new Date() })

                await notifyController.create(req.user.id, validatedBody.driver, description, validatedBody.id, 'TRANSFER_MONEY');
                notifyController.pushNotification(validatedBody.driver, 'TRANSFER_MONEY', validatedBody.id, description);
            } else {
                await Order.updateMany({ _id: { $in: validatedBody.orders } }, { traderPayoffDues: true, traderPayoffDuesDate: new Date() })

                await notifyController.create(req.user.id, validatedBody.trader, description, validatedBody.id, 'TRANSFER_MONEY');
                notifyController.pushNotification(validatedBody.trader, 'TRANSFER_MONEY', validatedBody.id, description);
            }
            res.status(200).send("Done");
            await countNew();
        } catch (err) {
            next(err);
        }
    },
}