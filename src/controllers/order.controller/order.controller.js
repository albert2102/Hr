import Order from "../../models/order.model/order.model";
import Product from '../../models/product.model/product.model';
import Address from '../../models/address.model/address.model';
import PromoCode from '../../models/promocode.model/promocode.model';
import User from '../../models/user.model/user.model';
import Notification from '../../models/notif.model/notif.model';
import CreditCard from '../../models/credit.model/credit.model';
import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { body } from 'express-validator/check';
import { checkValidations } from "../shared.controller/shared.controller";
import i18n from 'i18n';
import moment from 'moment'
import notifyController from '../notif.controller/notif.controller';
import socketEvents from '../../socketEvents';
import { generateVerifyCode } from '../../services/generator-code-service'
import Company from '../../models/company.model/company.model';
import config from '../../config';
import { sendEmail } from '../../services/emailMessage.service';
import { duration_time } from '../../calculateDistance'
import schedule from 'node-schedule';
import { sendHtmlEmail } from '../../services/emailMessage.service'

let populateQuery = [
    { path: 'user', model: 'user' },
    { path: 'driver', model: 'user' },
    { path: 'trader', model: 'user' },
    { path: 'products.product', model: 'product', populate: [{ path: 'trader', model: 'user' }, { path: 'productCategory', model: 'productCategory' }] },
    { path: 'address', model: 'address', populate: [{ path: 'city', model: 'city', populate: [{ path: 'country', model: 'country' }] }] },
    { path: 'promoCode', model: 'promocode' },
];

let TraderNotResponseCount = async () => {
    try {
        let count = await Order.count({ deleted: false, traderNotResponse: true, status: 'WAITING' });
        adminNSP.emit(socketEvents.TraderNotResponseCount, { count: count });

    } catch (error) {
        throw error;
    }
}
let traderOrdersCount = async (userId) => {
    try {
        let newOrdersQuery = { deleted: false, status: 'WAITING', trader: userId, traderNotResponse: false };
        let currentOrdersQuery = { deleted: false, trader: userId, status: { $in: ['ACCEPTED', 'DRIVER_ACCEPTED', 'SHIPPED'] } };
        let finishedOrdersQuery = { deleted: false, trader: userId, status: { $in: ['DELIVERED'] } };

        let promiseData = [
            Order.count(newOrdersQuery), Order.count(currentOrdersQuery), Order.count(finishedOrdersQuery)
        ];
        let result = await Promise.all(promiseData);
        console.log(result)
        notificationNSP.to('room-' + userId).emit(socketEvents.NewOrdersCount, { count: result[0] });
        notificationNSP.to('room-' + userId).emit(socketEvents.CurrentOrdersCount, { count: result[1] });
        notificationNSP.to('room-' + userId).emit(socketEvents.FinishedOrdersCount, { count: result[2] });

    } catch (error) {
        throw error;
    }
}
let driverOrdersCount = async (userId) => {
    try {
        let currentOrdersQuery = { deleted: false, driver: userId, status: { $in: ['ACCEPTED', 'DRIVER_ACCEPTED', 'SHIPPED'] } };
        let finishedOrdersQuery = { deleted: false, driver: userId, status: { $in: ['DELIVERED'] } };

        let promiseData = [
            Order.count(currentOrdersQuery), Order.count(finishedOrdersQuery)
        ];
        let result = await Promise.all(promiseData);
        notificationNSP.to('room-' + userId).emit(socketEvents.CurrentOrdersCount, { count: result[0] });
        notificationNSP.to('room-' + userId).emit(socketEvents.FinishedOrdersCount, { count: result[1] });

    } catch (error) {
        throw error;
    }
}

let checkAvailability = async (list) => {
    let trader;
    let products = [];
    for (let index = 0; index < list.length; index++) {
        let product = await Product.findById(list[index].product);
        if (trader && trader != product.trader) {
            throw new ApiError(400, 'Products must be from one store only !');
        } else {
            trader = product.trader;
        }
        let singleProduct = list[index];
        singleProduct.price = product.price;
        if (product.offer && product.offer > 0 && !product.buyOneGetOne) {
            singleProduct.offer = product.offer;
            singleProduct.priceAfterOffer = +((singleProduct.price - (singleProduct.price * (singleProduct.offer / 100.0))).toFixed(3))
        } else {
            singleProduct.priceAfterOffer = singleProduct.price;
        }
        products.push(singleProduct);
    }
    trader = await User.findById(trader);
    return ({ products, trader });

}

let calculatePrice = async (list) => {
    console.log(list)
    let price = 0;
    for (let index = 0; index < list.length; index++) {
        if (list[index].offer && list[index].offer > 0) {
            price = price + ((list[index].price - (+(list[index].price * (list[index].offer / 100.0)).toFixed(3))) * list[index].quantity);
        }
        else {
            price = price + (list[index].price * list[index].quantity)
        }
    }
    return price;

}

let getFinalPrice = async (validateBody) => {
    if (validateBody.promoCode) {
        let promoCode = await PromoCode.findById(validateBody.promoCode);
        let priceBeforeDiscount;
        if (promoCode.promoCodeType == 'RATIO') {

            if (promoCode.promoCodeOn == 'TRANSPORTATION') {
                priceBeforeDiscount = Number(validateBody.transportPrice);

                validateBody.discountValue = (priceBeforeDiscount * (promoCode.discount / 100))
                console.log(validateBody.discountValue)
                console.log(priceBeforeDiscount)
                if (promoCode.maxAmount && (validateBody.discountValue > promoCode.maxAmount)) {
                    validateBody.discountValue = Number(promoCode.maxAmount);
                }
                validateBody.totalPrice = Number(validateBody.price) + Number((priceBeforeDiscount - Number(validateBody.discountValue)).toFixed(3));
                console.log(validateBody.totalPrice)
            }
            else if (promoCode.promoCodeOn == 'PRODUCTS') {
                priceBeforeDiscount = validateBody.price;

                validateBody.discountValue = (priceBeforeDiscount * (promoCode.discount / 100))
                if (promoCode.maxAmount && (validateBody.discountValue > promoCode.maxAmount)) {
                    validateBody.discountValue = promoCode.maxAmount;
                }
                validateBody.totalPrice = Number(validateBody.transportPrice) + Number((priceBeforeDiscount - Number(validateBody.discountValue)).toFixed(3));
            }
            else {
                priceBeforeDiscount = Number(validateBody.price) + Number(validateBody.transportPrice);

                validateBody.discountValue = (priceBeforeDiscount * (promoCode.discount / 100))
                if (promoCode.maxAmount && (validateBody.discountValue > promoCode.maxAmount)) {
                    validateBody.discountValue = promoCode.maxAmount;
                }
                validateBody.totalPrice = +((priceBeforeDiscount - Number(validateBody.discountValue)).toFixed(3));
            }
        } else {

            if (promoCode.promoCodeOn == 'TRANSPORTATION') {
                priceBeforeDiscount = Number(validateBody.transportPrice);

                validateBody.discountValue = (((priceBeforeDiscount - promoCode.discount) > 0) ? promoCode.discount : 0);
                validateBody.totalPrice = Number(validateBody.price) + Number(priceBeforeDiscount) - Number(validateBody.discountValue);
            }
            else if (promoCode.promoCodeOn == 'PRODUCTS') {
                priceBeforeDiscount = +validateBody.price;

                validateBody.discountValue = (((priceBeforeDiscount - promoCode.discount) > 0) ? promoCode.discount : 0);
                validateBody.totalPrice = Number(validateBody.transportPrice) + Number(priceBeforeDiscount - Number(validateBody.discountValue))

            }
            else {
                priceBeforeDiscount = Number(validateBody.price) + Number(validateBody.transportPrice);

                validateBody.discountValue = (((priceBeforeDiscount - promoCode.discount) > 0) ? promoCode.discount : 0);
                validateBody.totalPrice = Number(priceBeforeDiscount - Number(validateBody.discountValue));

            }

        }

    } else {
        validateBody.totalPrice = Number(validateBody.price) + Number(validateBody.transportPrice);
    }
    return validateBody;
}

const orderService = async (order) => {
    try {
        let date = (new Date()).getTime();
        let company = await Company.findOne({ deleted: false });
        date = date + company.driverWaitingTime;
        date = new Date(date);
        let jobName = 'order-' + order.id;
        let currentOrder = await checkExistThenGet(order.id, Order, { populate: populateQuery });

        var j = schedule.scheduleJob(jobName, date, async (fireDate) => {
            try {
                console.log(jobName, ' fire date ', fireDate);
                currentOrder = await checkExistThenGet(order.id, Order);
                if (order.status == 'DRIVER_ACCEPTED') {
                    let validatedBody = { $addToSet: { rejectedDrivers: currentOrder.driver.id }, $unset: { driver: 1 } };
                    let updatedOrder = await Order.findByIdAndUpdate(order.id, validatedBody, { new: true }).populate(populateQuery);
                    notificationNSP.to('room-' + currentOrder.driver.id).emit(socketEvents.OrderExpired, { order: updatedOrder });
                    findDriver(updatedOrder);
                }
            } catch (error) {
                throw error;
            }
        })
    } catch (error) {
        throw error;
    }
}

const findDriver = async (order) => {
    try {
        let busyDrivers = await Order.find({ deleted: false, status: { $in: ['ACCEPTED', 'DRIVER_ACCEPTED', 'SHIPPED'], } }).distinct('driver');
        let userQuery = {
            deleted: false,
            online: true,
            status: 'ACCEPTED',
            type: 'DRIVER',
            _id: { $nin: busyDrivers },
        };

        let driver;
        let drivers = await User.aggregate([
            {
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: [+order.trader.geoLocation.coordinates[0], +order.trader.geoLocation.coordinates[1]]
                    },
                    distanceField: "dist.calculated"
                }
            },
            {
                $match: userQuery
            },
            {
                $limit: 10
            }
        ]);
        console.log('drivers length in find drivers ', drivers.length);
        if (drivers && (drivers.length > 0)) {
            driver = drivers[0];
        }

        if (driver) {
            console.log("in ifffffffffffffffffffffffffffffffffffff")
            order.driver = driver._id;
            order = await Order.findByIdAndUpdate(order.id, { driver: driver._id }).populate(populateQuery)
            orderService(order);
            notificationNSP.to('room-' + driver._id).emit(socketEvents.NewOrder, { order: order });
            let description = {
                ar: order.orderNumber + ' : ' + 'لديك طلب جديد ',
                en: order.orderNumber + ' : ' + 'You have a new Order'
            }
            await notifyController.create(order.user.id, order.trader.id, description, order.id, 'ORDER', order.id);
            notifyController.pushNotification(order.trader.id, 'ORDER', order.id, description, config.notificationTitle);
            driverOrdersCount(driver._id);
        } else {
            console.log("in elseeeeeeeeeeeeeeeeeeeeeeee")
            order = await Order.findByIdAndUpdate(order.id, { status: 'NOT_ASSIGN' });
        }
    } catch (error) {
        throw error;
    }
}

const traderService = async (order) => {
    try {
        let date = (new Date()).getTime();
        let company = await Company.findOne({ deleted: false });
        date = date + company.traderWaitingTime;
        date = new Date(date);
        let jobName = 'order-' + order.id;
        let currentOrder = await checkExistThenGet(order.id, Order, { populate: populateQuery });
        console.log(date)
        var j = schedule.scheduleJob(jobName, date, async (fireDate) => {
            try {
                console.log(jobName, ' fire date ', fireDate);
                currentOrder = await checkExistThenGet(order.id, Order);
                if (order.status == 'WAITING') {
                    let updatedOrder = await Order.findByIdAndUpdate(order.id, { traderNotResponse: true }, { new: true }).populate(populateQuery);
                    notificationNSP.to('room-' + currentOrder.trader.id).emit(socketEvents.OrderExpired, { order: updatedOrder });
                    TraderNotResponseCount();
                }
            } catch (error) {
                throw error;
            }
        })
    } catch (error) {
        throw error;
    }
}
export default {

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let { user, status, paymentMethod, month, year, fromDate, toDate, type,
                userName, price, orderDate, totalPrice, promoCode, orderType, driver,
                orderNumber, numberOfProducts, waitingOrders, currentOrders, finishedOrders, traderNotResponse, trader
            } = req.query;
            let query = { deleted: false, $or: [{ paymentMethod: 'CREDIT', paymentStatus: 'SUCCESSED' }, { paymentMethod: { $in: ['CASH', 'WALLET'] } }] };
            if (trader) query.trader = trader;
            if (orderType) query.orderType = orderType;
            if (driver) query.driver = driver;

            if (req.user.type == 'CLIENT') {
                query.user = req.user.id;
                if (currentOrders) {
                    query.status = { $in: ['WAITING', 'ACCEPTED', 'DRIVER_ACCEPTED', 'SHIPPED', 'NOT_ASSIGN'] }
                } else if (finishedOrders) {
                    query.status = { $in: ['DELIVERED', 'CANCELED', 'REJECTED'] }

                }
            }
            else if (req.user.type == 'INSTITUTION') {
                query.trader = req.user.id;
                if (waitingOrders) {
                    query.status = { $in: ['WAITING'] },
                        query.traderNotResponse = false;

                } else if (currentOrders) {
                    query.status = { $in: ['ACCEPTED', 'DRIVER_ACCEPTED', 'SHIPPED'] }

                } else if (finishedOrders) {
                    query.status = { $in: ['DELIVERED', 'REJECTED'] }

                }

            }
            else if (req.user.type == 'DRIVER') {
                query.driver = req.user.id;
                query.orderType = 'DELIVERY';
                if (waitingOrders) {
                    query.status = { $in: ['ACCEPTED'] }
                }
                else if (currentOrders) {
                    query.status = { $in: ['ACCEPTED', 'DRIVER_ACCEPTED', 'SHIPPED'] }

                } else if (finishedOrders) {
                    query.status = { $in: ['DELIVERED'] }
                }
            }
            let date = new Date();
            if (traderNotResponse) query.traderNotResponse = traderNotResponse
            if (orderDate) query.createdAt = { $gte: new Date(moment(orderDate).startOf('day')), $lt: new Date(moment(orderDate).endOf('day')) };

            if (userName) {
                let userIds = await User.find({ deleted: false, name: { '$regex': userName, '$options': 'i' } }).distinct('_id');
                query.user = { $in: userIds };
            }
            if (orderNumber) query.orderNumber = { '$regex': orderNumber, '$options': 'i' };
            if (promoCode) query.promoCode = promoCode;
            if (numberOfProducts || (numberOfProducts == 0)) query.products = { $size: numberOfProducts };
            if (user) query.user = user;
            if (totalPrice) query.totalPrice = totalPrice;
            if (price) query.price = price;
            if (type) query.type = type;
            if (status) query.status = status;
            if (paymentMethod) query.paymentMethod = paymentMethod;
            if (fromDate && !toDate) query.createdAt = { $gte: moment(fromDate).startOf('day') };
            if (toDate && !fromDate) query.createdAt = { $lt: moment(toDate).endOf('day') };
            if (fromDate && toDate) query.createdAt = { $gte: moment(fromDate).startOf('day'), $lt: moment(toDate).endOf('day') };
            if (month && year) {
                date = new Date();
                month = month - 1;
                date.setMonth(month);
                date.setFullYear(year);
                let startOfDate = moment(date).startOf('month');
                let endOfDate = moment(date).endOf('month');

                query.createdAt = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) }
            }
            else if (year && !month) {
                date.setFullYear(year);
                let startOfDate = moment(date).startOf('year');
                let endOfDate = moment(date).endOf('year');
                query.createdAt = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) }
            }

            let orders = await Order.find(query).populate(populateQuery).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit);
            orders = Order.schema.methods.toJSONLocalizedOnly(orders, i18n.getLocale());
            let ordersCount = await Order.count(query);
            const pageCount = Math.ceil(ordersCount / limit);
            res.send(new ApiResponse(orders, page, pageCount, limit, ordersCount, req));


        } catch (err) {
            next(err);
        }
    },

    validateBody() {
        return [
            body('products.*.product').not().isEmpty().withMessage(() => { return i18n.__('productRequired') })
                .custom(async (val, { req }) => {
                    let product = await checkExistThenGet(val, Product, { deleted: false, populate: [{ path: 'trader', model: 'user' }] }, i18n.__('productNotFound'));
                    if (product.trader.institutionStatus != 'OPEN') {
                        throw new Error(i18n.__('traderBusy'));
                    }
                    return true;
                }),
            body('products.*.quantity').not().isEmpty().withMessage(() => { return i18n.__('quantityRequired') }),
            body('address').optional().not().isEmpty().withMessage(() => { return i18n.__('addressRequired') })
                .custom(async (val, { req }) => {
                    req.address = await checkExistThenGet(val, Address, { deleted: false, user: req.user.id }, i18n.__('addressNotFound'));
                    return true;
                }),
            body('orderType').not().isEmpty().withMessage(() => { return i18n.__('orderTypeRequired') }).isIn(['DELIVERY', 'FROM_STORE']).withMessage('Wrong type')
                .custom(async (val, { req }) => {
                    if (val == 'DELIVERY' && !req.body.address) {
                        throw new Error(i18n.__('addressRequired'));
                    }
                    if (val == 'DELIVERY' && !req.body.durationDelivery) {
                        throw new Error(i18n.__('durationDeliveryRequired'));
                    }
                    return true;
                }),
            body('paymentMethod').not().isEmpty().withMessage(() => { return i18n.__('paymentMethodRequired') }).isIn(['DIGITAL', 'WALLET', 'CASH']).withMessage('Wrong type')
                .custom(async (val, { req }) => {
                    if (val == 'DIGITAL' && !req.body.creditCard) {
                        throw new Error(i18n.__('creditCardRequired'));
                    }
                    return true;
                }),
            body('creditCard').optional().not().isEmpty().withMessage(() => { return i18n.__('creditCardRequired') })
                .custom(async (val, { req }) => {
                    let query = { deleted: false, user: req.user.id };
                    req.creditCard = await checkExistThenGet(val, CreditCard, query);
                    return true;
                }),
            body('promoCode').optional().not().isEmpty().withMessage(() => { return i18n.__('promocodeRequired') })
                .custom(async (val, { req }) => {
                    let currentDate = new Date();
                    let query = {
                        deleted: false,
                        startDate: { $lte: currentDate },
                        endDate: { $gte: currentDate },
                        $or: [{ usersType: 'ALL' }, { usersType: 'SPECIFIC', users: { $elemMatch: { $eq: req.user.id } } }]
                    };
                    let promoCode = await checkExistThenGet(val, PromoCode, query, i18n.__('promoCodeInvalid'));
                    let count = await Order.count({ deleted: false, user: req.user.id, promoCode: promoCode.id });
                    if (count >= promoCode.numberOfUse) {
                        throw new Error(i18n.__('ExccedPromoCodeNumberOuse'));
                    }
                    return true;
                }),
            body('durationDelivery').optional().not().isEmpty().withMessage(() => { return i18n.__('durationDeliveryRequired') }).isNumeric().withMessage('must be a numeric'),
            body('order').optional().not().isEmpty().withMessage(() => { return i18n.__('orderRequired') }),
        ];
    },

    async create(req, res, next) {
        try {
            let user = req.user;
            let validatedBody = checkValidations(req);
            validatedBody.orderNumber = '' + (new Date()).getTime();
            validatedBody.user = user.id;
            let resuktCheckAval = await checkAvailability(validatedBody.products);
            validatedBody.products = resuktCheckAval.products;

            /////////////////////////// Taxes ///////////////////////////////
            let company = await Company.findOne({ deleted: false });
            let trader = resuktCheckAval.trader;
            validatedBody.trader = trader.id;
            if ((trader.type == 'INSTITUTION' && !trader.productsIncludeTaxes) || trader.type == 'ADMIN' || trader.type == 'SUB_ADMIN') {
                validatedBody.taxes = company.taxes;
            } else {
                validatedBody.taxes = 0;
            }
            //////////////////////////Treansportation Price////////////////////////////////
            if (validatedBody.orderType == 'DELIVERY') {
                // let duration = 0;
                // duration = await duration_time({ lat: req.user.geoLocation.coordinates[1], long: req.user.geoLocation.coordinates[0] }, { lat: trader.geoLocation.coordinates[1], long: trader.geoLocation.coordinates[0] });
                // let durationPrice = duration * Number(trader.deliveryPricePerSecond);
                // validatedBody.durationDelivery = duration;

                let durationPrice = Number(validatedBody.durationDelivery) * Number(trader.deliveryPricePerSecond);
                console.log(durationPrice)
                if (durationPrice < Number(trader.minDeliveryPrice)) {
                    validatedBody.transportPrice = Number(trader.minDeliveryPrice);
                } else {
                    validatedBody.transportPrice = durationPrice;
                }
            } else {
                validatedBody.transportPrice = 0;
            }

            ///////////////////////////////////////////////////////////////////////////////
            validatedBody.price = await calculatePrice(validatedBody.products)
            validatedBody = await getFinalPrice(validatedBody)

            validatedBody.totalPrice = validatedBody.totalPrice + Number(validatedBody.taxes)
            if (validatedBody.paymentMethod == 'WALLET' && req.user.wallet < validatedBody.totalPrice) {
                return next(new ApiError(400, i18n.__('walletInvalid')));
            }
            if (validatedBody.paymentMethod == 'DIGITAL') {
                return next(new ApiError(400, i18n.__('notAvaliableNow')));
            }

            /////////////////////////////////////////////////////////////////////////////////////////////
            validatedBody.ajamTaxes = Number(trader.ajamTaxes);

            if (validatedBody.orderType == 'FROM_STORE') {
                let ajamprice = (validatedBody.totalPrice - validatedBody.transportPrice);
                validatedBody.ajamDues = (ajamprice * (Number(validatedBody.ajamTaxes) / 100)).toFixed(2);
                validatedBody.driverDues = 0;
                validatedBody.traderDues = ajamprice - Number(validatedBody.ajamDues);
            } else {
                let ajamprice = (validatedBody.totalPrice - validatedBody.transportPrice);
                validatedBody.ajamDues = (ajamprice * (Number(validatedBody.ajamTaxes) / 100)).toFixed(2);
                validatedBody.driverDues = validatedBody.transportPrice;
                validatedBody.traderDues = ajamprice - Number(validatedBody.ajamDues);
            }
            /////////////////////////////////////////////////////////////////////////////////////////////

            let order = await Order.create(validatedBody);
            order.orderNumber = order.orderNumber + order.id;
            await order.save();
            res.status(200).send(order);
            order = await Order.populate(order, populateQuery)
            let description = {
                ar: order.orderNumber + ' : ' + 'لديك طلب جديد ',
                en: order.orderNumber + ' : ' + 'You have a new Order'
            }
            await notifyController.create(req.user.id, order.trader.id, description, order.id, 'ORDER', order.id);
            notifyController.pushNotification(order.trader.id, 'ORDER', order.id, description, config.notificationTitle);
            notificationNSP.to('room-' + order.trader.id).emit(socketEvents.NewOrder, { order: order });
            traderOrdersCount(order.trader.id);
            traderService(order);
            await sendHtmlEmail(req.user.email,order.orderNumber,order.products.length,order.totalPrice,order.transportPrice,order.taxes,order.address.address,order.address.addressName,order.address.buildingNumber,order.address.flatNumber,order.totalPrice);

        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { orderId } = req.params;
            let order = await checkExistThenGet(orderId, Order, { deleted: false, populate: populateQuery });
            order = Order.schema.methods.toJSONLocalizedOnly(order, i18n.getLocale());
            res.status(200).send(order);

        } catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let { orderId } = req.params;
            let order = await checkExistThenGet(orderId, Order, { deleted: false });
            order.deleted = true;
            await order.save();
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    },

    validateAcceptOrReject() {
        let validations = [
            body('status').optional().not().isEmpty().withMessage(() => { return i18n.__('statusRequired') })
                .isIn(['ACCEPTED', 'REJECTED']).withMessage(() => { return i18n.__('statusRequired') }).custom((val, { req }) => {
                    if (val == 'REJECTED' && !req.body.rejectReason) {
                        throw new Error(i18n.__('rejectReasonRequired'))
                    }
                    return true;
                }),
            body('rejectReason').optional().not().isEmpty().withMessage(() => { return i18n.__('rejectReasonRequired') })
        ];
        return validations;
    },

    async acceptOrReject(req, res, next) {
        try {
            if (req.user.type != 'ADMIN' && req.user.type != 'SUB_ADMIN' && req.user.type != 'INSTITUTION')
                return next(new ApiError(403, ('notAllowToChangeStatus')));

            let { orderId } = req.params;
            await checkExist(orderId, Order, { deleted: false, status: 'WAITING' });
            let validatedBody = checkValidations(req);
            let updatedOrder = await Order.findByIdAndUpdate(orderId, validatedBody, { new: true }).populate(populateQuery);
            updatedOrder = Order.schema.methods.toJSONLocalizedOnly(updatedOrder, i18n.getLocale());
            res.status(200).send(updatedOrder);
            let description;

            if (validatedBody.status == 'ACCEPTED') {
                ////////////// find drivers /////////////////////////
                await findDriver(updatedOrder);
                ////////////////////////////////////////////////////
                description = { en: updatedOrder.orderNumber + ' : ' + 'Your Order Has Been Approved', ar: updatedOrder.orderNumber + ' : ' + '  جاري تجهيز طلبك' };
            } else {
                description = { en: updatedOrder.orderNumber + ' : ' + 'Your Order Has Been Rejected ' + validatedBody.rejectReason, ar: updatedOrder.orderNumber + ' : ' + ' تم رفض طلبك ' + validatedBody.rejectReason };
            }

            await notifyController.create(req.user.id, updatedOrder.user.id, description, updatedOrder.id, 'CHANGE_ORDER_STATUS', updatedOrder.id);
            notifyController.pushNotification(updatedOrder.user.id, 'CHANGE_ORDER_STATUS', updatedOrder.id, description, config.notificationTitle);

            notificationNSP.to('room-' + updatedOrder.user.id).emit(socketEvents.ChangeOrderStatus, { order: updatedOrder });

            if (updatedOrder.user.language == "ar") {
                await sendEmail(updatedOrder.user.email, description.ar)
            }
            else {
                await sendEmail(updatedOrder.user.email, description.en)
            }

        } catch (err) {
            // console.log(err);
            next(err);
        }
    },

    validateDriverAcceptOrReject() {
        let validations = [
            body('status').optional().not().isEmpty().withMessage(() => { return i18n.__('statusRequired') })
                .isIn(['ACCEPTED', 'REJECTED']).withMessage(() => { return i18n.__('statusRequired') })
        ];
        return validations;
    },

    async driverAcceptOrReject(req, res, next) {
        try {
            if (req.user.type != 'DRIVER')
                return next(new ApiError(403, ('notAllowToChangeStatus')));

            let { orderId } = req.params;
            await checkExist(orderId, Order, { deleted: false, status: 'ACCEPTED', driver: req.user.id });
            let updatedOrder;
            let validatedBody = checkValidations(req);
            if (validatedBody.status == 'ACCEPTED') {
                validatedBody.status = 'DRIVER_ACCEPTED';
                updatedOrder = await Order.findByIdAndUpdate(orderId, validatedBody, { new: true }).populate(populateQuery);
                notificationNSP.to('room-' + updatedOrder.user.id).emit(socketEvents.ChangeOrderStatus, { order: updatedOrder });
                notificationNSP.to('room-' + updatedOrder.trader.id).emit(socketEvents.ChangeOrderStatus, { order: updatedOrder });

            } else {
                validatedBody['$addToSet'] = { rejectedDrivers: req.user.id };
                delete validatedBody.status;
                updatedOrder = await Order.findByIdAndUpdate(orderId, validatedBody, { new: true }).populate(populateQuery);
                await findDriver(updatedOrder);
            }
            updatedOrder = Order.schema.methods.toJSONLocalizedOnly(updatedOrder, i18n.getLocale());
            res.status(200).send(updatedOrder);

        } catch (err) {
            next(err);
        }
    },

    async shipped(req, res, next) {
        try {
            if (req.user.type != 'ADMIN' && req.user.type != 'SUB_ADMIN' && req.user.type != 'INSTITUTION')
                return next(new ApiError(403, ('admin.auth')));

            let { orderId } = req.params;
            await checkExist(orderId, Order, { deleted: false, $or: [{ status: "ACCEPTED", orderType: "FROM_STORE" }, { status: "DRIVER_ACCEPTED", orderType: "DELIVERY" }] });
            let updatedOrder = await Order.findByIdAndUpdate(orderId, { status: 'SHIPPED' }, { new: true }).populate(populateQuery);
            updatedOrder = Order.schema.methods.toJSONLocalizedOnly(updatedOrder, i18n.getLocale());
            res.status(200).send(updatedOrder);

            let description = { ar: updatedOrder.orderNumber + ' : ' + ' تم تغير حالة الطلب الي تم الشحن ', en: updatedOrder.orderNumber + ' : ' + 'Order Status Changed To Order Shipped' };

            await notifyController.create(req.user.id, updatedOrder.user.id, description, updatedOrder.id, 'CHANGE_ORDER_STATUS', updatedOrder.id);
            notifyController.pushNotification(updatedOrder.user.id, 'CHANGE_ORDER_STATUS', updatedOrder.id, description, config.notificationTitle);

            notificationNSP.to('room-' + updatedOrder.user.id).emit(socketEvents.ChangeOrderStatus, { order: updatedOrder });

            if (updatedOrder.user.language == "ar") {
                await sendEmail(updatedOrder.user.email, description.ar)
            }
            else {
                await sendEmail(updatedOrder.user.email, description.en)
            }
        } catch (err) {
            next(err);
        }
    },

    async delivered(req, res, next) {
        try {
            let { orderId } = req.params;
            await checkExist(orderId, Order, { deleted: false, $or: [{ status: "ACCEPTED", orderType: "FROM_STORE" }, { status: "SHIPPED", orderType: "DELIVERY" }] });
            let updatedOrder = await Order.findByIdAndUpdate(orderId, { status: 'DELIVERED', deliveredDate: new Date() }, { new: true }).populate(populateQuery);
            updatedOrder = Order.schema.methods.toJSONLocalizedOnly(updatedOrder, i18n.getLocale());
            res.status(200).send(updatedOrder);

            let description = { ar: updatedOrder.orderNumber + ' : ' + ' تم تغير حالة الطلب الي تم التسليم ', en: updatedOrder.orderNumber + ' : ' + 'Order Status Changed To Delivered' };

            await notifyController.create(req.user.id, updatedOrder.user.id, description, updatedOrder.id, 'CHANGE_ORDER_STATUS', updatedOrder.id);
            notifyController.pushNotification(updatedOrder.user.id, 'CHANGE_ORDER_STATUS', updatedOrder.id, description, config.notificationTitle);

            notificationNSP.to('room-' + updatedOrder.user.id).emit(socketEvents.ChangeOrderStatus, { order: updatedOrder });
            notificationNSP.to('room-' + updatedOrder.trader.id).emit(socketEvents.ChangeOrderStatus, { order: updatedOrder });

            if (updatedOrder.user.language == "ar") {
                await sendEmail(updatedOrder.user.email, description.ar)
            }
            else {
                await sendEmail(updatedOrder.user.email, description.en)
            }

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            traderOrdersCount(updatedOrder.trader.id);
            driverOrdersCount(updatedOrder.driver.id);

        } catch (err) {
            next(err);
        }
    },

    async canceled(req, res, next) {
        try {
            let user = req.user;
            let { orderId } = req.params;
            let order = await checkExistThenGet(orderId, Order, { deleted: false, populate: populateQuery }, i18n.__('notAllowToCancel'));
            if (user.type == 'CLIENT' && order.user.id != user.id) {
                return next(new ApiError(403, i18n__('notAllowToCancel')));
            }
            if (order.orderType == 'DELIVERY' && order.status == 'DRIVER_ACCEPTED') {
                return next(new ApiError(403, i18n__('notAllowToCancel')));
            }
            order.status = 'CANCELED';
            await order.save();
            res.status(200).send(order);
            let description = { ar: order.orderNumber + ' : ' + 'تم الغاء هذا الطلب ', en: order.orderNumber + ' : ' + ' Order Canceled' };

            await notifyController.create(req.user.id, order.user.id, description, order.id, 'CHANGE_ORDER_STATUS', order.id);
            notifyController.pushNotification(order.user.id, 'CHANGE_ORDER_STATUS', order.id, description, config.notificationTitle);
            notificationNSP.to('room-' + order.trader.id).emit(socketEvents.ChangeOrderStatus, { order: order });

        } catch (err) {
            next(err);
        }
    },

    ///////////////////////////////Rate/////////////////////////////////////////
    validateTraderRate() {
        let validations = [
            body('traderRateEmotion').not().isEmpty().withMessage(() => { return i18n.__('traderRateEmotionRequired') })
                .isIn(['BAD', 'GOOD', 'EXCELLENT']).withMessage(() => { return i18n.__('WrongType') }),
            body('traderRateComment').optional().not().isEmpty().withMessage(() => { return i18n.__('traderRateCommentRequired') }),
            body('order').not().isEmpty().withMessage(() => { return i18n.__('orderRequired') }).custom(async (val, { req }) => {
                req.order = await checkExistThenGet(val, Order, { deleted: false, traderRateEmotion: null, status: "DELIVERED", user: req.user.id })
                return true;
            }),
        ];
        return validations;
    },
    async traderRate(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            let order = req.order;
            if (validatedBody.traderRateEmotion == 'BAD') {
                validatedBody.traderRateValue = 1;
            } else if (validatedBody.traderRateEmotion == 'GOOD') {
                validatedBody.traderRateValue = 3;
            } else {
                validatedBody.traderRateValue = 5;
            }
            let updatedOrder = await Order.findByIdAndUpdate(order._id, validatedBody, { new: true }).populate(populateQuery);
            let trader = await User.findOne({ _id: order.trader });
            trader.totalRateCount = trader.totalRateCount + 1;
            trader.totalRate = trader.totalRate + validatedBody.traderRateValue;
            await trader.save();
            res.status(200).send(updatedOrder);
        } catch (err) {
            next(err);
        }
    },

    async getRates(req, res, next) {
        try {

            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let user = req.user;
            let query = { deleted: false, trader: user.id, traderRateValue: { $ne: null } };

            let orders = await Order.find(query).select([ '_id', 'user', 'traderRateValue', 'traderRateEmotion', 'traderRateComment']).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit).populate(populateQuery);
            let ordersCount = await Order.count(query);
            const pageCount = Math.ceil(ordersCount / limit);
            res.send(new ApiResponse(orders, page, pageCount, limit, ordersCount, req));

        } catch (err) {
            next(err);
        }
    },
    traderOrdersCount,
    driverOrdersCount,
    TraderNotResponseCount,
    /////////////////////////////////////////////////////////////////////////////////

    validateResendOrderToTrader() {
        let validations = [
            body('order').not().isEmpty().withMessage(() => { return i18n.__('orderRequired') })
        ];
        return validations;
    },
    async resendOrderToTrader(req, res, next) {
        try {
            if (req.user.type != 'ADMIN' && req.user.type != 'SUB_ADMIN')
                return next(new ApiError(403, ('notAllowToChangeStatus')));

            let validatedBody = checkValidations(req);
            await checkExist(validatedBody.order, Order, { deleted: false, status: 'WAITING', traderNotResponse: true });
            let updatedOrder = await Order.findByIdAndUpdate(orderId, { traderNotResponse: false }, { new: true }).populate(populateQuery);
            updatedOrder = Order.schema.methods.toJSONLocalizedOnly(updatedOrder, i18n.getLocale());
            res.status(200).send(updatedOrder);
            let description = { en: updatedOrder.orderNumber + ' : ' + 'The admin sent the order back to you. Please accept the order as soon as possible.', ar: updatedOrder.orderNumber + ' : ' + '  قام الادمن بإعادة ارسال الطلب اليك مرة اخري من فضلك وافق على الطلب في اسرع وقت ' };

            await notifyController.create(req.user.id, updatedOrder.trader.id, description, updatedOrder.id, 'ORDER', updatedOrder.id);
            notifyController.pushNotification(updatedOrder.trader.id, 'ORDER', updatedOrder.id, description, config.notificationTitle);
            notificationNSP.to('room-' + updatedOrder.trader.id).emit(socketEvents.NewOrder, { order: updatedOrder });
            traderOrdersCount(updatedOrder.trader.id);

        } catch (err) {
            next(err);
        }
    },

    ////////////////////////////////////Dues////////////////////////////////////////
    async traderGetSales(req, res, next) {
        try {

            let user = req.user;
            let { fromDate, toDate } = req.query;

            let query = { deleted: false, trader: +user.id, status: 'DELIVERED' };

            if (fromDate && !toDate) query.createdAt = { $gte: new Date(moment(fromDate).startOf('day')) };
            if (toDate && !fromDate) query.createdAt = { $lt: new Date(moment(toDate).endOf('day')) };
            if (fromDate && toDate) query.createdAt = { $gte: new Date(moment(fromDate).startOf('day')), $lt: new Date(moment(toDate).endOf('day')) };


            let results = await Order.aggregate()
                .match(query)
                .group({
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 },
                    totalDues: { $sum: { $cond: [ { $and: [{ $eq: ["$traderPayoffDues", false] }, { $eq: ["$orderType", 'DELIVERY'] }] }, '$traderDues', 0] } },
                    orders: { $push: '$$ROOT' }
                })

                for (let index = 0; index < results.length; index++) {
                    const element = array[index];
                    
                }
            res.send({ data: results });

        } catch (err) {
            next(err);
        }
    },

    async driverGetSales(req, res, next) {
        try {

            let user = req.user;
            let { fromDate, toDate } = req.query;

            let query = { deleted: false, driver: +user.id, status: 'DELIVERED', orderType: 'DELIVERY', paymentMethod: { $ne: 'CASH' } };
            let realizedQuery = { deleted: false, driver: +user.id, status: 'DELIVERED', orderType: 'DELIVERY', paymentMethod: 'CASH' };
            if (fromDate && !toDate) query.createdAt = { $gte: new Date(moment(fromDate).startOf('day')) };
            if (toDate && !fromDate) query.createdAt = { $lt: new Date(moment(toDate).endOf('day')) };
            if (fromDate && toDate) query.createdAt = { $gte: new Date(moment(fromDate).startOf('day')), $lt: new Date(moment(toDate).endOf('day')) };


            let results = await Order.aggregate()
                .match(query)
                .group({
                    _id: null,
                    count: { $sum: 1 },
                    totalDues: { $sum: { $cond: [{ $eq: ["$driverPayoffDues", false] }, '$driverDues', 0] } },
                    orders: { $push: '$$ROOT' }
                })

            let results2 = await Order.aggregate()
                .match(realizedQuery)
                .group({
                    _id: null,
                    count: { $sum: 1 },
                    totalDues: { $sum: '$totalPrice' },
                    orders: { $push: '$$ROOT' }
                })
            // .limit(limit)
            // .skip((page - 1) * limit );

            res.send({ data: results, data2: results2 });

        } catch (err) {
            next(err);
        }
    },
}