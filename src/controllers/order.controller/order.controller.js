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
import { sendEmail, sendHtmlEmail, sendChangeOrderEmail } from '../../services/emailMessage.service';
import { duration_time } from '../../calculateDistance'
import schedule from 'node-schedule';
import https from 'https';
import querystring from 'querystring';
import Zone from '../../models/zone.model/zone.model';
import pluck from 'arr-pluck';

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

        await User.findByIdAndUpdate(userId, { waitingOrderCount: result[0], currentOrderCount: result[1], finishedOrderCount: result[2] })

    } catch (error) {
        throw error;
    }
}
let driverOrdersCount = async (userId) => {
    try {
        let currentOrdersQuery = { deleted: false, driver: userId, status: { $in: ['DRIVER_ACCEPTED', 'SHIPPED'] } };
        let finishedOrdersQuery = { deleted: false, driver: userId, status: { $in: ['DELIVERED'] } };

        let promiseData = [
            Order.count(currentOrdersQuery), Order.count(finishedOrdersQuery)
        ];
        let result = await Promise.all(promiseData);
        notificationNSP.to('room-' + userId).emit(socketEvents.CurrentOrdersCount, { count: result[0] });
        notificationNSP.to('room-' + userId).emit(socketEvents.FinishedOrdersCount, { count: result[1] });

        await User.findByIdAndUpdate(userId, { currentOrderCount: result[0], finishedOrderCount: result[1] })

    } catch (error) {
        throw error;
    }
}
let clientOrdersCount = async (userId) => {
    try {
        let currentOrdersQuery = { deleted: false, user: userId }
        let count = await Order.count(currentOrdersQuery)

        await User.findByIdAndUpdate(userId, { ordersCount: count })

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
        console.log(new Date())

        let jobName = 'order-' + order.id;
        let currentOrder = await checkExistThenGet(order.id, Order, { populate: populateQuery });

        var j = schedule.scheduleJob(jobName, date, async (fireDate) => {
            try {
                console.log(jobName, ' fire date ', fireDate);
                currentOrder = await checkExistThenGet(order.id, Order);
                console.log(currentOrder)
                if (currentOrder.status == 'ACCEPTED') {
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
        
        let busyDrivers = await Order.find({ deleted: false, status: { $in: ['ACCEPTED', 'DRIVER_ACCEPTED', 'SHIPPED'], } }).distinct('driver');
        let userQuery = {
            deleted: false,
            online: true,
            activated: true,
            ajamTaxes: { $ne: null },
            status: 'ACCEPTED',
            type: 'DRIVER',
            _id: { $nin: busyDrivers },
            _id: { $nin: order.rejectedDrivers },
            stopReceiveOrders: false
        };
        console.log("busyDrivers === ",busyDrivers)
        console.log("rejectedDrivers === ",rejectedDrivers)
        if(busyDrivers.length > 0 && order.rejectedDrivers.length > 0){
            let busyIds = busyDrivers.concat(order.rejectedDrivers);
            userQuery._id = {$nin: busyIds};
        }

        let driver;
        let zones = await Zone.aggregate([
            // Find points or objects "near" and project the distance
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
                $match: { deleted: false, user: { $ne: null } }
            },
            // Logically filter anything outside of the radius
            {
                $redact: {
                    $cond: {
                        if: { $gt: ["$dist.calculated", "$radius"] },
                        then: "$$PRUNE",
                        else: "$$KEEP"
                    }
                }
            },

        ]);

        let ids = [...pluck(zones, 'user')];
        console.log("zones ====== ", ids)
        if (userQuery._id) {
            userQuery._id['$in'] =  ids ;
        } else {
            userQuery._id = { $in: ids };
        }
        // console.log(userQuery)
        let drivers = await User.find(userQuery);

        if(order.paymentMethod != 'CASH'){
            userQuery.stopReceiveOrders = true;
            let stopDriversForCreditOnly = await User.find(userQuery);
            if(stopDriversForCreditOnly.length > 0) drivers = drivers.concat(stopDriversForCreditOnly);

        }

        console.log('drivers length in find drivers ', drivers.length);
        if (drivers && (drivers.length > 0)) {
            driver = drivers[0];
        }

        if (driver) {
            console.log("in ifffffffffffffffffffffffffffffffffffff")
            order.driver = driver._id;
            order = await Order.findByIdAndUpdate(order.id, { driver: driver._id, lastActionDate: new Date() }).populate(populateQuery)
            orderService(order);
            notificationNSP.to('room-' + driver._id).emit(socketEvents.NewOrder, { order: order });
            let description = {
                ar: 'لديك طلب جديد ',
                en: 'You have a new Order'
            }
            await notifyController.create(order.user.id, order.trader.id, description, order.id, 'ORDER', order.id);
            notifyController.pushNotification(order.trader.id, 'ORDER', order.id, description);
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
        console.log(new Date())
        date = new Date(date);
        let jobName = 'trader-order-' + order.id;
        let currentOrder = await checkExistThenGet(order.id, Order, { populate: populateQuery });
        console.log(date)
        var j = schedule.scheduleJob(jobName, date, async (fireDate) => {
            try {
                console.log(jobName, ' fire date ', fireDate);
                currentOrder = await checkExistThenGet(order.id, Order);
                if (currentOrder.status == 'WAITING') {
                    let updatedOrder = await Order.findByIdAndUpdate(order.id, { traderNotResponse: true }, { new: true }).populate(populateQuery);
                    notificationNSP.to('room-' + updatedOrder.trader.id).emit(socketEvents.OrderExpired, { order: updatedOrder });
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

//////////////////////////Payment////////////////////////
const getCheckoutId = async (request, response, next, order, paymentBrand) => {
    try {
        let cardEntityId;
        var checkoutIdPath = '/v1/checkouts';
        let amount = order.totalPrice;
        let name = request.user.name.split(" ");
        if (name.length == 1) {
            name.push(name[0]);
        }
        if (paymentBrand == 'MADA') {
            cardEntityId = config.payment.Entity_ID_Mada;
        } else {
            cardEntityId = config.payment.Entity_ID_Card;
        }
        let address = 'From Store';
        if (order.orderType != 'FROM_STORE') {
            address = request.address.address;
        }

        let body = {
            'merchantTransactionId': order.orderNumber,
            'entityId': cardEntityId,
            'amount': Number(amount).toFixed(2),
            'currency': config.payment.Currency,
            'paymentType': config.payment.PaymentType,
            'notificationUrl': config.payment.notificationUrl,
            'testMode': config.payment.testMode,
            'customer.email': request.user.email || '',
            'billing.street1': address || '',
            'billing.city': 'Riyadh',
            'billing.state': 'Layla',
            'billing.country': 'SA',
            'billing.postcode': '11461',
            'customer.givenName': name[0],
            'customer.surname': name[1]
        }
        // if(paymentBrand != 'MADA') body.testMode = config.payment.testMode;
        console.log(body)
        var data = querystring.stringify(body);
        var options = {
            port: 443,
            host: config.payment.host,
            path: checkoutIdPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': data.length,
                'Authorization': config.payment.access_token
            }
        };
        var postRequest = https.request(options, function (res) {
            res.setEncoding('utf8');
            res.on('data', async function (chunk) {
                let result = JSON.parse(chunk)
                console.log(result)

                result = { checkoutId: result.id, amount: amount }
                console.log(result)
                result.order = await Order.findByIdAndUpdate(order.id, { $set: { checkoutId: result.checkoutId, paymentStatus: 'PENDING' } }, { new: true });
                response.status(200).send(result);
            });
        });
        postRequest.write(data);
        postRequest.end();
    } catch (error) {
        next(error)
    }
}
////////////////////////////////////////////////////////////////////////////
export default {

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let { user, status, paymentMethod, month, year, fromDate, toDate, type,
                userName, price, orderDate, totalPrice, promoCode, orderType, driver,
                orderNumber, numberOfProducts, waitingOrders, currentOrders, finishedOrders, traderNotResponse, trader,defaultOrders
            } = req.query;
            let query = { deleted: false, $or: [{ paymentMethod: 'DIGITAL', paymentStatus: 'SUCCESSED' }, { paymentMethod: { $in: ['CASH', 'WALLET'] } }] };
            if (trader) query.trader = trader;
            if (orderType) query.orderType = orderType;
            if (driver) query.driver = driver;

            if (req.user.type == 'CLIENT') {
                query.user = req.user.id;
                if (currentOrders) {
                    query.status = { $in: ['WAITING', 'ACCEPTED', 'DRIVER_ACCEPTED', 'SHIPPED','NOT_ASSIGN'] }
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
                    query.status = { $in: ['ACCEPTED', 'DRIVER_ACCEPTED', 'SHIPPED','NOT_ASSIGN'] }

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
                    query.status = { $in: ['DRIVER_ACCEPTED', 'SHIPPED'] }

                } else if (finishedOrders) {
                    query.status = { $in: ['DELIVERED'] }
                }
            }
            //////admin tab///////
            if(defaultOrders){
                query.status = {$in:['WAITING','ACCEPTED','DRIVER_ACCEPTED','REJECTED', 'CANCELED', 'SHIPPED', 'DELIVERED']}
            }
            let date = new Date();
            if (traderNotResponse) {
                query.traderNotResponse = traderNotResponse;
                if (traderNotResponse == true) query.status = 'WAITING';
            }
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
                    if (!product.trader.ajamTaxes) {
                        throw new Error(i18n.__('notAllowToMakeOrder'));
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
               /* .custom(async (val, { req }) => {
                    if (val == 'DIGITAL' && !req.body.creditCard) {
                        throw new Error(i18n.__('creditCardRequired'));
                    }
                    return true;
                })*/,
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
                // validatedBody.durationDelivery = Math.round(validatedBody.durationDelivery / 60 ) // client update to be by minutes
                validatedBody.durationDelivery = Math.round(validatedBody.durationDelivery);
                let durationPrice = Number(validatedBody.durationDelivery) * Number(trader.deliveryPricePerSecond); // per minutes
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

            // console.log('validatedBody.totalPrice ',validatedBody.totalPrice);
            validatedBody.totalPrice = validatedBody.totalPrice + ((validatedBody.price / 100) * Number(validatedBody.taxes));
            validatedBody.totalPrice = (validatedBody.totalPrice).toFixed(2);
            // validatedBody.totalPrice = parseInt(validatedBody.totalPrice);
            if (validatedBody.paymentMethod == 'WALLET' && req.user.wallet < validatedBody.totalPrice) {
                return next(new ApiError(400, i18n.__('walletInvalid')));
            }


            /////////////////////////////////////////////////////////////////////////////////////////////
            validatedBody.ajamTaxes = Number(trader.ajamTaxes) || 5;

            if (validatedBody.orderType == 'FROM_STORE') {
                validatedBody.driverDues = 0;
            } else {
                validatedBody.driverDues = validatedBody.transportPrice;
            }
            //////////////////////////////////////////////////////////////////
            if (trader.type == 'INSTITUTION' && !trader.productsIncludeTaxes) {
                let traderPrice = validatedBody.price;
                validatedBody.ajamDues = (traderPrice * (Number(validatedBody.ajamTaxes) / 100)).toFixed(2);
                validatedBody.traderDues = (traderPrice - Number(validatedBody.ajamDues)) + ((validatedBody.price / 100) * Number(validatedBody.taxes));
            }
            else {
                let taxes = company.taxes;
                let traderPrice = validatedBody.price - ((validatedBody.price / 100) * Number(taxes));
                validatedBody.ajamDues = (traderPrice * (Number(validatedBody.ajamTaxes) / 100)).toFixed(2);
                validatedBody.traderDues = (traderPrice - Number(validatedBody.ajamDues)) + ((validatedBody.price / 100) * Number(taxes));
            }

            /////////////////////////////////////////////////////////////////////////////////////////////
            validatedBody.lastActionDate = new Date();
            let order = await Order.create(validatedBody);
            order.orderNumber = order.orderNumber + order.id;
            await order.save();
            if (validatedBody.paymentMethod == 'DIGITAL') {
                getCheckoutId(req, res, next, order, 'VISA');
            } else {
                res.status(200).send(order);
            }
            order = await Order.populate(order, populateQuery)
            ///////////////////////////////////////////

            if (validatedBody.paymentMethod == 'WALLET') {
                user.wallet = user.wallet - order.totalPrice;
                await user.save();
                notificationNSP.to('room-' + user.id).emit(socketEvents.NewUser, { user: user });

            }
            //////////////////////////////////////////
            let description = {
                ar: 'لديك طلب جديد ',
                en: 'You have a new Order'
            }
            await notifyController.create(req.user.id, order.trader.id, description, order.id, 'ORDER', order.id);
            notifyController.pushNotification(order.trader.id, 'ORDER', order.id, description);
            notificationNSP.to('room-' + order.trader.id).emit(socketEvents.NewOrder, { order: order });
            traderOrdersCount(order.trader.id);
            traderService(order);
            ////////////////////////////////////////////////////////////////////////////////////////////
            clientOrdersCount(req.user.id);
            ////////////////////////////////////////////////////////////////////////////////////////////
            await sendHtmlEmail(req.user.email, order.orderNumber, order.products.length, order.price, order.transportPrice, order.taxes, order.address.address, order.address.addressName, order.address.buildingNumber, order.address.flatNumber, order.totalPrice);

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
            clientOrdersCount(order.user);

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
            await checkExist(orderId, Order, { deleted: false/*, status: 'WAITING'*/ });
            let validatedBody = checkValidations(req);
            if (validatedBody.status == 'ACCEPTED') {
                validatedBody.acceptedDate = new Date();
            } else {
                validatedBody.rejectedDate = new Date();
            }
            let updatedOrder = await Order.findByIdAndUpdate(orderId, validatedBody, { new: true }).populate(populateQuery);
            updatedOrder = Order.schema.methods.toJSONLocalizedOnly(updatedOrder, i18n.getLocale());
            res.status(200).send(updatedOrder);
            let description;

            if (validatedBody.status == 'ACCEPTED') {
                ////////////// find drivers /////////////////////////
                if (updatedOrder.orderType == 'DELIVERY') await findDriver(updatedOrder);
                ////////////////////////////////////////////////////
                description = { en: 'Your Order Has Been Approved', ar: '  جاري تجهيز طلبك' };
            } else {
                description = { en: 'Your Order Has Been Rejected ' + validatedBody.rejectReason, ar: ' تم رفض طلبك ' + validatedBody.rejectReason };
            }

            await notifyController.create(req.user.id, updatedOrder.user.id, description, updatedOrder.id, 'CHANGE_ORDER_STATUS', updatedOrder.id);
            notifyController.pushNotification(updatedOrder.user.id, 'CHANGE_ORDER_STATUS', updatedOrder.id, description);

            notificationNSP.to('room-' + updatedOrder.user.id).emit(socketEvents.ChangeOrderStatus, { order: updatedOrder });

            if (updatedOrder.user.language == "ar") {
                await sendChangeOrderEmail(updatedOrder.user.email, description.ar + ' : ' + updatedOrder.orderNumber)
            }
            else {
                await sendChangeOrderEmail(updatedOrder.user.email, description.en + ' : ' + updatedOrder.orderNumber)
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
                validatedBody.driverAcceptedDate = new Date();
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
            let updatedOrder = await Order.findByIdAndUpdate(orderId, { status: 'SHIPPED', shippedDate: new Date() }, { new: true }).populate(populateQuery);
            updatedOrder = Order.schema.methods.toJSONLocalizedOnly(updatedOrder, i18n.getLocale());
            res.status(200).send(updatedOrder);

            let description = { ar: ' تم تغير حالة الطلب الي تم الشحن ', en: 'Order Status Changed To Order Shipped' };

            await notifyController.create(req.user.id, updatedOrder.user.id, description, updatedOrder.id, 'CHANGE_ORDER_STATUS', updatedOrder.id);
            notifyController.pushNotification(updatedOrder.user.id, 'CHANGE_ORDER_STATUS', updatedOrder.id, description);

            notificationNSP.to('room-' + updatedOrder.user.id).emit(socketEvents.ChangeOrderStatus, { order: updatedOrder });

            if (updatedOrder.user.language == "ar") {
                await sendChangeOrderEmail(updatedOrder.user.email, description.ar + ' : ' + updatedOrder.orderNumber)
            }
            else {
                await sendChangeOrderEmail(updatedOrder.user.email, description.en + ' : ' + updatedOrder.orderNumber)
            }
        } catch (err) {
            next(err);
        }
    },

    async delivered(req, res, next) {
        try {
            let { orderId } = req.params;
            let order = await checkExistThenGet(orderId, Order, { deleted: false, $or: [{ status: "ACCEPTED", orderType: "FROM_STORE" }, { status: "SHIPPED", orderType: "DELIVERY" }] });
            let updatedQuery = { status: 'DELIVERED', deliveredDate: new Date() };
            if (order.orderType == 'DELIVERY' && order.driver) {
                let driver = await User.findById(order.driver);
                updatedQuery.ajamTaxesFromDriver = driver.ajamTaxes;
                updatedQuery.ajamDuesFromDriver = (Number(order.transportPrice) * (Number(updatedQuery.ajamTaxesFromDriver) / 100)).toFixed(2);
                updatedQuery.driverDues = order.driverDues - updatedQuery.ajamDuesFromDriver;

            }
            let updatedOrder = await Order.findByIdAndUpdate(orderId, updatedQuery, { new: true }).populate(populateQuery);
            updatedOrder = Order.schema.methods.toJSONLocalizedOnly(updatedOrder, i18n.getLocale());
            res.status(200).send(updatedOrder);

            let description = { ar: ' تم تغير حالة الطلب الي تم التسليم ', en: 'Order Status Changed To Delivered' };

            await notifyController.create(req.user.id, updatedOrder.user.id, description, updatedOrder.id, 'CHANGE_ORDER_STATUS', updatedOrder.id);
            notifyController.pushNotification(updatedOrder.user.id, 'CHANGE_ORDER_STATUS', updatedOrder.id, description);

            notificationNSP.to('room-' + updatedOrder.user.id).emit(socketEvents.ChangeOrderStatus, { order: updatedOrder });
            notificationNSP.to('room-' + updatedOrder.trader.id).emit(socketEvents.ChangeOrderStatus, { order: updatedOrder });

            if (updatedOrder.user.language == "ar") {
                await sendChangeOrderEmail(updatedOrder.user.email, description.ar + ' : ' + updatedOrder.orderNumber)
            }
            else {
                await sendChangeOrderEmail(updatedOrder.user.email, description.en + ' : ' + updatedOrder.orderNumber)
            }

            ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            traderOrdersCount(updatedOrder.trader.id);
            if (updatedOrder.orderType == 'DELIVERY') {
                driverOrdersCount(updatedOrder.driver.id);
            }

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
            if (user.type == 'CLIENT' && order.orderType == 'DELIVERY' && order.status == 'DRIVER_ACCEPTED') {
                return next(new ApiError(403, i18n__('notAllowToCancel')));
            }
            order.status = 'CANCELED';
            order.cancelledDate = new Date();
            await order.save();
            res.status(200).send(order);
            let description = { ar: 'تم الغاء هذا الطلب ', en: ' Order Canceled' };

            await notifyController.create(req.user.id, order.trader.id, description, order.id, 'CHANGE_ORDER_STATUS', order.id);
            notifyController.pushNotification(order.trader.id, 'CHANGE_ORDER_STATUS', order.id, description);
            notificationNSP.to('room-' + order.trader.id).emit(socketEvents.ChangeOrderStatus, { order: order });

            if (user.type == 'ADMIN' || user.type == 'SUB_ADMIN') {

                await notifyController.create(req.user.id, order.user.id, description, order.id, 'CHANGE_ORDER_STATUS', order.id);
                notifyController.pushNotification(order.user.id, 'CHANGE_ORDER_STATUS', order.id, description);
                notificationNSP.to('room-' + order.user.id).emit(socketEvents.ChangeOrderStatus, { order: order });

            }

            ////////////////////////////RefundOrder////////////////////////////////////////
            if (order.paymentMethod == 'DIGITAL' || order.paymentMethod == 'WALLET') {
                let newUser = await User.findByIdAndUpdate(order.user.id, { wallet: order.user.wallet + order.totalPrice });
                notificationNSP.to('room-' + user.id).emit(socketEvents.NewUser, { user: newUser });

                description = { ar: 'تم استرجاع قيمة الطلب في محفظتك يمكنك الاطلاع عليه ', en: 'The value of the order has been recovered in your wallet, you can view it.' };
                await notifyController.create(req.user.id, order.user.id, description, order.id, 'REFUNDED_TO_WALLET', order.id);
                notifyController.pushNotification(order.user.id, 'REFUNDED_TO_WALLET', order.id, description);

            }
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
            let { trader } = req.query;

            if (!trader) return next(new ApiError('trader is required in query'));
            let query = { deleted: false, trader: trader, traderRateValue: { $ne: null } };

            let orders = await Order.find(query).select(['_id', 'user', 'traderRateValue', 'traderRateEmotion', 'traderRateComment']).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit).populate(populateQuery);
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
            let updatedOrder = await Order.findByIdAndUpdate(validatedBody.order, { traderNotResponse: false, lastActionDate: new Date() }, { new: true }).populate(populateQuery);
            updatedOrder = Order.schema.methods.toJSONLocalizedOnly(updatedOrder, i18n.getLocale());
            res.status(200).send(updatedOrder);
            let description = { en: 'The admin sent the order back to you. Please accept the order as soon as possible.', ar: '  قام الادمن بإعادة ارسال الطلب اليك مرة اخري من فضلك وافق على الطلب في اسرع وقت ' };

            await notifyController.create(req.user.id, updatedOrder.trader.id, description, updatedOrder.id, 'ORDER', updatedOrder.id);
            notifyController.pushNotification(updatedOrder.trader.id, 'ORDER', updatedOrder.id, description);
            notificationNSP.to('room-' + updatedOrder.trader.id).emit(socketEvents.NewOrder, { order: updatedOrder });
            traderOrdersCount(updatedOrder.trader.id);

        } catch (err) {
            next(err);
        }
    },

    ////////////////////////////////////Dues////////////////////////////////////////
    async traderGetSales(req, res, next) {
        try {
            let user;
            let { fromDate, toDate } = req.query;

            if (req.user.type == 'ADMIN' || req.user.type == 'SUB_ADMIN') {
                if (!req.query.user) {
                    return next(new ApiError(403, ('specifiuserinquery')));
                } else {
                    user = req.query.user;
                    user = await checkExistThenGet(user, User, { deleted: false })
                }
            } else {
                user = req.user;
            }

            let query = { deleted: false, trader: +user.id, status: 'DELIVERED' };

            if (fromDate && !toDate) query.createdAt = { $gte: new Date(moment(fromDate).startOf('day')) };
            if (toDate && !fromDate) query.createdAt = { $lt: new Date(moment(toDate).endOf('day')) };
            if (fromDate && toDate) query.createdAt = { $gte: new Date(moment(fromDate).startOf('day')), $lt: new Date(moment(toDate).endOf('day')) };


            let results = await Order.aggregate()
                .match(query)
                .group({
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 },
                    totalDues: { $sum: { $cond: [{ $and: [{ $eq: ["$traderPayoffDues", false] }, { $eq: ["$orderType", 'DELIVERY'] }] }, '$traderDues', 0] } },
                    orders: { $push: '$$ROOT' }
                })
            let total = 0;
            for (let index = 0; index < results.length; index++) {
                total += results[index].totalDues;
            }
            res.send({ data: results, total: total });

        } catch (err) {
            next(err);
        }
    },

    async driverGetSales(req, res, next) {
        try {

            let user;
            let { fromDate, toDate } = req.query;

            if (req.user.type == 'ADMIN' || req.user.type == 'SUB_ADMIN') {
                if (!req.query.user) {
                    return next(new ApiError(403, ('specifiuserinquery')));
                } else {
                    user = req.query.user;
                    user = await checkExistThenGet(user, User, { deleted: false })
                }
            } else {
                user = req.user;
            }

            let query = { deleted: false, driver: +user.id, status: 'DELIVERED', orderType: 'DELIVERY' };
            let notCashQuery = { deleted: false, driver: +user.id, status: 'DELIVERED', orderType: 'DELIVERY', paymentMethod: { $ne: 'CASH' } };
            let cashQuery = { deleted: false, driver: +user.id, status: 'DELIVERED', orderType: 'DELIVERY', paymentMethod: 'CASH' };
            if (fromDate && !toDate) query.createdAt = { $gte: new Date(moment(fromDate).startOf('day')) };
            if (toDate && !fromDate) query.createdAt = { $lt: new Date(moment(toDate).endOf('day')) };
            if (fromDate && toDate) query.createdAt = { $gte: new Date(moment(fromDate).startOf('day')), $lt: new Date(moment(toDate).endOf('day')) };


            let cashResult = await Order.aggregate()
                .match(cashQuery)
                .group({
                    _id: null,
                    count: { $sum: 1 },
                    totalDues: { $sum: { $cond: [{ $eq: ["$driverPayoffDues", false] }, '$totalPrice', 0] } },
                    driverDues: { $sum: { $cond: [{ $eq: ["$driverPayoffDues", false] }, '$driverDues', 0] } },
                    // orders: { $push: '$$ROOT' }
                })

            let notCashResult = await Order.aggregate()
                .match(notCashQuery)
                .group({
                    _id: null,
                    count: { $sum: 1 },
                    totalDues: { $sum: { $cond: [{ $eq: ["$driverPayoffDues", false] }, '$driverDues', 0] } },
                    // orders: { $push: '$$ROOT' }
                })

            let results = await Order.aggregate()
                .match(query)
                .group({
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 },
                    orders: { $push: '$$ROOT' }
                })

            let totalCash = 0;
            let totalNotCash = 0;
            let total = 0;
            for (let index = 0; index < cashResult.length; index++) {
                totalCash += (cashResult[index].totalDues - cashResult[index].driverDues);
            }
            for (let index = 0; index < notCashResult.length; index++) {
                totalNotCash += notCashResult[index].totalDues;
            }
            total = totalNotCash - totalCash;
            total = total + Number(user.wallet);

            res.send({ data: results, total: total });
            if (total < 0) {
                user.currentAppAmount = total;
                let comapny = await Company.findOne({ deleted: false });
                if (total <= comapny.driverDuesToStop) {
                    user.stopReceiveOrders = true;
                }
                await user.save();

            }
        } catch (err) {
            next(err);
        }
    },


    validateDeleteMulti() {
        return [
            body('ids').not().isEmpty().withMessage(() => { return i18n.__('idsRequired') }).isArray().withMessage('must be array'),
        ];
    },
    async deleteMuti(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, i18n.__('unauthrized')));

            let validatedBody = checkValidations(req);
            await Order.updateMany({ _id: { $in: validatedBody.ids }, deleted: false }, { deleted: true, deletedDate: new Date() })
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    },

    /////////////////////////////////////////////////////////////////////////////////

    validateResendOrderToDriver() {
        let validations = [
            body('order').not().isEmpty().withMessage(() => { return i18n.__('orderRequired') }),
            body('driver').not().isEmpty().withMessage(() => { return i18n.__('driverRequired') })
                .custom(async (val, { req }) => {
                    req.driver = await checkExistThenGet(val, User, { deleted: false, type: 'DRIVER' })
                    return true;
                }),
        ];
        return validations;
    },
    async resendOrderToDriver(req, res, next) {
        try {
            if (req.user.type != 'ADMIN' && req.user.type != 'SUB_ADMIN')
                return next(new ApiError(403, ('notAllowToChangeStatus')));

            let validatedBody = checkValidations(req);
            await checkExist(validatedBody.order, Order, { deleted: false, status: 'NOT_ASSIGN' });
            let updatedOrder = await Order.findByIdAndUpdate(validatedBody.order, { status: 'ACCEPTED', driver: validatedBody.driver, lastActionDate: new Date() }, { new: true }).populate(populateQuery);
            updatedOrder = Order.schema.methods.toJSONLocalizedOnly(updatedOrder, i18n.getLocale());
            res.status(200).send(updatedOrder);
            let description = { en: 'The admin sent the order to you. Please accept the order as soon as possible.', ar: '  قام الادمن بارسال الطلب اليك مرة اخري من فضلك وافق على الطلب في اسرع وقت ' };

            await notifyController.create(req.user.id, updatedOrder.driver.id, description, updatedOrder.id, 'ORDER', updatedOrder.id);
            notifyController.pushNotification(updatedOrder.driver.id, 'ORDER', updatedOrder.id, description);

            notificationNSP.to('room-' + updatedOrder.driver.id).emit(socketEvents.NewOrder, { order: updatedOrder });
            driverOrdersCount(updatedOrder.driver.id);
            findDriver(updatedOrder);


        } catch (err) {
            next(err);
        }
    },
}
