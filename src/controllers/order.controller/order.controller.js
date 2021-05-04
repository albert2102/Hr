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

let populateQuery = [
    { path: 'user', model: 'user' },
    { path: 'driver', model: 'user' },
    { path: 'trader', model: 'user' },
    { path: 'products.product', model: 'product', populate: [{ path: 'trader', model: 'user' }, { path: 'productCategory', model: 'productCategory' }] },
    { path: 'address', model: 'address', populate: [{ path: 'city', model: 'city', populate: [{ path: 'country', model: 'country' }] }] },
    { path: 'promoCode', model: 'promocode' },
];

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
                if (promoCode.maxAmount && (validateBody.discountValue > promoCode.maxAmount)) {
                    validateBody.discountValue = promoCode.maxAmount;
                }
                validateBody.totalPrice = Number(validateBody.price + ((priceBeforeDiscount - Number(validateBody.discountValue)).toFixed(3)));
            }
            else if (promoCode.promoCodeOn == 'PRODUCTS') {
                priceBeforeDiscount = validateBody.price;

                validateBody.discountValue = (priceBeforeDiscount * (promoCode.discount / 100))
                if (promoCode.maxAmount && (validateBody.discountValue > promoCode.maxAmount)) {
                    validateBody.discountValue = promoCode.maxAmount;
                }
                validateBody.totalPrice = Number(+validateBody.transportPrice + ((priceBeforeDiscount - Number(validateBody.discountValue)).toFixed(3)));
            }
            else {
                priceBeforeDiscount = validateBody.price + Number(validateBody.transportPrice);

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
                validateBody.totalPrice = Number(validateBody.price + (priceBeforeDiscount - Number(validateBody.discountValue)));
            }
            else if (promoCode.promoCodeOn == 'PRODUCTS') {
                priceBeforeDiscount = +validateBody.price;

                validateBody.discountValue = (((priceBeforeDiscount - promoCode.discount) > 0) ? promoCode.discount : 0);
                validateBody.totalPrice = Number(validateBody.transportPrice) + Number(priceBeforeDiscount - Number(validateBody.discountValue))

            }
            else {
                priceBeforeDiscount = +validateBody.price + Number(validateBody.transportPrice);

                validateBody.discountValue = (((priceBeforeDiscount - promoCode.discount) > 0) ? promoCode.discount : 0);
                validateBody.totalPrice = +(priceBeforeDiscount - Number(validateBody.discountValue));

            }

        }

    } else {
        validateBody.totalPrice = validateBody.price + Number(validateBody.transportPrice);
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
                    let validatedBody = { $addToSet: { rejectedDrivers: currentOrder.driver }, $unset: { driver: 1 } };
                    let updatedOrder = await Order.findByIdAndUpdate(order.id, validatedBody, { new: true }).populate(populateQuery);
                    notificationNSP.to('room-' + currentOrder.driver).emit(socketEvents.OrderExpired, { order: updatedOrder });
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
        let busyDrivers = await Order.find({ deleted: false, status: { $in: ['ACCEPTED', 'SHIPPED'], } }).distinct('driver');
        let userQuery = {
            deleted: false,
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
            order.driver = driver._id;
            await order.save();
            orderService(order);
            notificationNSP.to('room-' + driver._id).emit(socketEvents.NewOrder, { order: order });
        } else {
            order.status = 'NOT_ASSIGN';
            await order.save();
        }
    } catch (error) {
        throw error;
    }
}
export default {

    async findAll(req, res, next) {
        try {

            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let { user, status, paymentMethod, month, year, fromDate, toDate, type, formDate,
                userName, _id, price, orderDate, totalPrice, promoCode,
                orderNumber, numberOfProducts, visitorsOrder
            } = req.query;
            let query = { deleted: false, $or: [{ paymentMethod: 'CREDIT', paymentStatus: 'SUCCESSED' }, { paymentMethod: 'CASH' }] };
            let date = new Date();

            if (orderDate) query.createdAt = { $gte: new Date(moment(orderDate).startOf('day')), $lt: new Date(moment(orderDate).endOf('day')) };

            if (formDate) {
                fromDate = formDate;
            }
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
            if ((req.user.type == 'ADMIN') || (req.user.type == 'SUB_ADMIN')) {
                await Order.updateMany({ deleted: false, type: type, adminInformed: false }, { $set: { adminInformed: true } });
                let onlineOrder = await Order.count({ deleted: false, type: 'ONLINE', adminInformed: false });
                let manualOrder = await Order.count({ deleted: false, type: 'MANULAY', adminInformed: false });
                adminNSP.emit(socketEvents.UpdateOrderCount, { onlineOrder, manualOrder });
            }


        } catch (err) {
            next(err);
        }
    },

    validateBody() {
        return [
            body('products.*.product').not().isEmpty().withMessage(() => { return i18n.__('productRequired') })
                .custom(async (val, { req }) => {
                    req.product = await checkExistThenGet(val, Product, { deleted: false }, i18n.__('productNotFound'));
                    return true;
                }),
            body('products.*.quantity').not().isEmpty().withMessage(() => { return i18n.__('quantityRequired') }),
            body('address').optional().not().isEmpty().withMessage(() => { return i18n.__('addressRequired') })
                .custom(async (val, { req }) => {
                    req.address = await checkExistThenGet(val, Address, { deleted: false, user: req.user.id }, i18n.__('addressNotFound'));
                    return true;
                }),
            body('orderType').not().isEmpty().withMessage(() => { return i18n.__('paymentMethodRequired') }).isIn(['DELIVERY', 'FROM_STORE']).withMessage('Wrong type')
                .custom(async (val, { req }) => {
                    if (val == 'DELIVERY' && !req.body.address) {
                        throw new Error(i18n.__('addressRequired'));
                    }
                    return true;
                }),
            body('paymentMethod').not().isEmpty().withMessage(() => { return i18n.__('paymentMethodRequired') }).isIn(['DIGITAL', 'WALLET', 'CASH']).withMessage('Wrong type'),
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
            //////////////////////////Transportation Price////////////////////////////////
            if (validatedBody.orderType == 'DELIVERY') {
                let duration = 0;
                duration = await duration_time({ lat: req.user.geoLocation.coordinates[1], long: req.user.geoLocation.coordinates[0] }, { lat: trader.geoLocation.coordinates[1], long: trader.geoLocation.coordinates[0] });
                let durationPrice = duration * Number(trader.deliveryPricePerSecond);
                validatedBody.durationDelivery = duration;
                if (durationPrice < trader.minDeliveryPrice) {
                    validatedBody.transportPrice = trader.minDeliveryPrice;
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

            let order = await Order.create(validatedBody);
            order.orderNumber = order.orderNumber + order.id;
            await order.save();
            //if (validatedBody.paymentMethod == 'CASH') {
                res.status(200).send(order);
                order = await Order.populate(order, populateQuery)
                let newOrdersCount = await Order.count({ deleted: false, adminInformed: false });
                adminNSP.emit(socketEvents.UpdateOrderCount, { count: newOrdersCount });
           // }

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
                await reversProductQuantity(updatedOrder.products);
                description = { en: updatedOrder.orderNumber + ' : ' + 'Your Order Has Been Rejected ' + validatedBody.rejectReason, ar: updatedOrder.orderNumber + ' : ' + ' تم رفض طلبك ' + validatedBody.rejectReason };
            }
            await notifyController.create(req.user.id, updatedOrder.user.id, description, updatedOrder.id, 'CHANGE_ORDER_STATUS', updatedOrder.id);
            notificationNSP.to('room-' + updatedOrder.user.id).emit(socketEvents.ChangeOrderStatus, { order: updatedOrder });
            if (updatedOrder.user.language == "ar") {
                notifyController.pushNotification(updatedOrder.user.id, 'CHANGE_ORDER_STATUS', updatedOrder.id, description.ar, config.notificationTitle.ar);
                await sendEmail(updatedOrder.user.email, description.ar)
            }
            else {
                notifyController.pushNotification(updatedOrder.user.id, 'CHANGE_ORDER_STATUS', updatedOrder.id, description.en, config.notificationTitle.en);
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
            let validatedBody = checkValidations(req);
            if (validatedBody.status == 'ACCEPTED') {
                validatedBody.status = 'DRIVER_ACCEPTED';
            } else {
                validatedBody['$addToSet'] = { rejectedDrivers: req.user.id };
                delete validatedBody.status;
            }
            let updatedOrder = await Order.findByIdAndUpdate(orderId, validatedBody, { new: true }).populate(populateQuery);
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
            await checkExist(orderId, Order, { deleted: false, status: "ACCEPTED" });
            let updatedOrder = await Order.findByIdAndUpdate(orderId, { status: 'SHIPPED' }, { new: true }).populate(populateQuery);
            updatedOrder = Order.schema.methods.toJSONLocalizedOnly(updatedOrder, i18n.getLocale());
            res.status(200).send(updatedOrder);
            let description = { ar: updatedOrder.orderNumber + ' : ' + ' تم تغير حالة الطلب الي تم الشحن ', en: updatedOrder.orderNumber + ' : ' + 'Order Status Changed To Order Shipped' };
            await notifyController.create(req.user.id, updatedOrder.user.id, description, updatedOrder.id, 'CHANGE_ORDER_STATUS', updatedOrder.id);
            notificationNSP.to('room-' + updatedOrder.user.id).emit(socketEvents.ChangeOrderStatus, { order: updatedOrder });
            if (updatedOrder.user.language == "ar") {
                notifyController.pushNotification(updatedOrder.user.id, 'CHANGE_ORDER_STATUS', updatedOrder.id, description.ar, config.notificationTitle.ar);
                await sendEmail(updatedOrder.user.email, description.ar)
            }
            else {
                notifyController.pushNotification(updatedOrder.user.id, 'CHANGE_ORDER_STATUS', updatedOrder.id, description.en, config.notificationTitle.en);
                await sendEmail(updatedOrder.user.email, description.ar)
            }
        } catch (err) {
            next(err);
        }
    },

    async delivered(req, res, next) {
        try {
            if (req.user.type != 'ADMIN' && req.user.type != 'SUB_ADMIN')
                return next(new ApiError(403, ('admin.auth')));

            let { orderId } = req.params;
            await checkExist(orderId, Order, { deleted: false, status: "SHIPPED" });
            let updatedOrder = await Order.findByIdAndUpdate(orderId, { status: 'DELIVERED', deliveredDate: new Date() }, { new: true }).populate(populateQuery);
            updatedOrder = Order.schema.methods.toJSONLocalizedOnly(updatedOrder, i18n.getLocale());
            res.status(200).send(updatedOrder);

            let description = { ar: updatedOrder.orderNumber + ' : ' + ' تم تغير حالة الطلب الي تم التسليم ', en: updatedOrder.orderNumber + ' : ' + 'Order Status Changed To Delivered' };
            await notifyController.create(req.user.id, updatedOrder.user.id, description, updatedOrder.id, 'CHANGE_ORDER_STATUS', updatedOrder.id);
            notificationNSP.to('room-' + updatedOrder.user.id).emit(socketEvents.ChangeOrderStatus, { order: updatedOrder });
            if (updatedOrder.user.language == "ar") {
                notifyController.pushNotification(updatedOrder.user.id, 'CHANGE_ORDER_STATUS', updatedOrder.id, description.ar, config.notificationTitle.ar);
                await sendEmail(updatedOrder.user.email, description.ar)
            }
            else {
                notifyController.pushNotification(updatedOrder.user.id, 'CHANGE_ORDER_STATUS', updatedOrder.id, description.en, config.notificationTitle.en);
                await sendEmail(updatedOrder.user.email, description.en)
            }

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////


        } catch (err) {
            next(err);
        }
    },

    async canceled(req, res, next) {
        try {
            let { orderId } = req.params;
            let order = await checkExistThenGet(orderId, Order, { deleted: false, user: req.user.id, populate: populateQuery }, i18n.__('notAllowToCancel'));
            if (order.status != 'WAITING') {
                next(new ApiError(400, i18n.__('notAllowToCancel')))
            }
            order.status = 'CANCELED'
            await order.save();
            await reversProductQuantity(order.products);
            res.status(200).send(order);
        } catch (err) {
            next(err);
        }
    },
}