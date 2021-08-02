import User from "../../models/user.model/user.model";
import config from '../../config'
import Order from "../../models/order.model/order.model";
import { body } from 'express-validator/check';
import { checkValidations } from "../shared.controller/shared.controller";
import orderControler from "../order.controller/order.controller";
import { checkExistThenGet } from "../../helpers/CheckMethods";
import i18n from 'i18n'
var https = require('https');
var querystring = require('querystring');
import CreditCard from "../../models/credit.model/credit.model";

let populateQuery = [
    { path: 'user', model: 'user' },
    { path: 'trader', model: 'user' },
    { path: 'products.product', model: 'product', populate: [{ path: 'trader', model: 'user' }, { path: 'productCategory', model: 'productCategory' }] },
    { path: 'address', model: 'address', populate: [{ path: 'city', model: 'city', populate: [{ path: 'country', model: 'country' }] }] },
    { path: 'promoCode', model: 'promocode' },
    { path: 'category', model: 'category' },
];

export default {
    validateGetCheckoutId() {
        return [
            body('amount').not().isEmpty().withMessage(() => { return i18n.__('amountRequired') }),
            body('creditCard').not().isEmpty().withMessage(() => { return i18n.__('creditCardRequired') })
                .custom(async (value, { req }) => {
                    req.credit = await checkExistThenGet(value, CreditCard, { deleted: false, user: req.user.id });
                    return true;
                }),
        ]
    },

    async getCreditCheckoutId(request, response, next) {
        try {
            let cardEntityId;
            var checkoutIdPath = '/v1/checkouts';
            const validatedBody = checkValidations(request);
            let amount = validatedBody.amount;
            let name = request.user.name.split(" ");
            if (name.length == 1) {
                name.push(name[0]);
            }

            /*if (request.credit.paymentBrand == 'MADA') {
                cardEntityId = config.payment.Entity_ID_Mada;
            } else {*/
            cardEntityId = config.payment.Entity_ID_Card;
            // }

            var data = querystring.stringify({
                'entityId': cardEntityId,
                'amount': amount,
                'currency': config.payment.Currency,
                'paymentType': config.payment.PaymentType,
                'notificationUrl': config.payment.notificationUrl,
                'customer.email': request.user.email || '',
                'billing.street1': request.user.address || '',
                'billing.city': 'Riyadh',
                'billing.state': 'Layla',
                'billing.country': 'SA',
                'billing.postcode': '11461',
                'customer.givenName': name[0],
                'customer.surname': name[1]
            });
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
            console.log(data)
            var postRequest = https.request(options, function (res) {
                res.setEncoding('utf8');
                res.on('data', async function (chunk) {
                    let result = { result: JSON.parse(chunk), amount: amount }
                    console.log("result : ", result)
                    let user = await User.findByIdAndUpdate(request.user.id, { lastCheckoutCredit: amount, lastCheckoutCreditId: result.result.id });
                    response.status(200).send(result);
                });
            });
            postRequest.write(data);
            postRequest.end();
        } catch (error) {
            next(error)
        }
    },

    validateGetPaymentStatus() {
        return [
            body('resourcePath').not().isEmpty().withMessage('resourcePathRequired'),

        ]
    },

    async getPaymentStatus(request, response, next) {
        try {
            const validatedBody = checkValidations(request);
            var path = '/v1/checkouts/' + validatedBody.resourcePath + '/payment';
            path += '?entityId=' + config.payment.Entity_ID_Card;
            console.log(path)
            var options = {
                port: 443,
                host: config.payment.host,
                path: path,
                method: 'GET',
                headers: {
                    'Authorization': config.payment.access_token
                }
            };
            // console.log(options)
            let jsonResult = "";
            var postRequest = https.request(options, function (res) {
                res.setEncoding('utf8');
                res.on('data', async function (chunk) {
                    try {
                        jsonResult = jsonResult + chunk;
                        console.log({ data: JSON.parse(jsonResult) })
                    } catch (error) {
                        next(error);
                    }
                });
                res.on('end', async function () {
                    // return response.status(200).send({data:JSON.parse(jsonResult)})
                    let state = JSON.parse(jsonResult);
                    const success_regex_1 = RegExp(/^(000\.000\.|000\.100\.1|000\.[36])/);
                    const success_regex_2 = RegExp(/^(000\.400\.0[^3]|000\.400\.100)/);
                    if (success_regex_1.test(state.result.code) || success_regex_2.test(state.result.code)) {
                        let user = await User.findOne({ deleted: false, _id: request.user.id, lastCheckoutCreditId: validatedBody.resourcePath });
                        if (user) {
                            user.credit = user.credit + user.lastCheckoutCredit;
                            user.lastCheckoutCredit = 0;
                            await user.save();
                            return response.status(200).send({ user, result: i18n.__('paymentSuccess') });
                        } else {
                            let order =  await Order.findOneAndUpdate({ checkoutId: validatedBody.resourcePath }, { $set: { paymentStatus: 'SUCCESSED', paymentId: state.id } }).populate(populateQuery);
                            return response.status(200).send({ result: i18n.__('paymentSuccess') });
                        }
                    } else {
                        await Order.updateOne({ checkoutId: validatedBody.resourcePath }, { $set: { deleted: true, paymentStatus: 'FAILED' } });
                        return response.status(400).send({ result: i18n.__('paymentFail') });
                    }
                })
            });
            postRequest.end();
        } catch (error) {
            next(error)
        }
    },

    async notification(request, response, next) {
        try {
            let { id, resourcePath } = request.query;
            const validatedBody = { resourcePath: resourcePath }
            var path = '/v1/checkouts/' + validatedBody.resourcePath + '/payment';
            path += '?entityId=' + config.payment.Entity_ID_Card;
            console.log(path)
            var options = {
                port: 443,
                host: config.payment.host,
                path: path,
                method: 'GET',
                headers: {
                    'Authorization': config.payment.access_token
                }
            };
            let jsonResult = "";
            var postRequest = https.request(options, function (res) {
                res.setEncoding('utf8');
                res.on('data', async function (chunk) {
                    try {
                        jsonResult = jsonResult + chunk;
                    } catch (error) {
                        next(error);
                    }
                });
                res.on('end', async function () {
                    let state = JSON.parse(jsonResult);
                    const success_regex_1 = RegExp(/^(000\.000\.|000\.100\.1|000\.[36])/);
                    const success_regex_2 = RegExp(/^(000\.400\.0[^3]|000\.400\.100)/);
                    if (success_regex_1.test(state.result.code) || success_regex_2.test(state.result.code)) {
                        let user = await User.findOne({ deleted: false, lastCheckoutCreditId: validatedBody.resourcePath });
                        if (user) {
                            user.credit = user.credit + user.lastCheckoutCredit;
                            user.lastCheckoutCredit = 0;
                            await user.save();
                            return response.status(200).send({ user, result: i18n.__('paymentSuccess') });
                        } else {
                            await Order.updateOne({ checkoutId: validatedBody.resourcePath }, { $set: { paymentStatus: 'SUCCESSED' } });
                            return response.status(200).send({ result: i18n.__('paymentSuccess') });
                        }
                    } else {
                        await Order.updateOne({ checkoutId: validatedBody.resourcePath }, { $set: { deleted: true, paymentStatus: 'FAILED' } });
                        return response.status(400).send({ result: i18n.__('paymentFail') });
                    }
                })
            });
            postRequest.end();
        } catch (error) {
            next(error)
        }
    },

    validateRefund() {
        return [
            body('order').not().isEmpty().withMessage('orderRequired')
        ]
    },

    async refundCreditPayment(req, response, next) {
        try {
            const validatedBody = checkValidations(req);
            let order = await checkExistThenGet(validatedBody.order, Order, { populate: [{ path: 'creditCard', model: 'credit' }], user: req.user.id, deleted: false, paymentStatus: 'SUCCESSED', paymentMethod: 'CREDIT' });

            let checkoutId = order.paymentId;
            console.log(checkoutId);
            const path = `/v1/payments/${checkoutId}`;
            console.log(path)
            const data = querystring.stringify({
                'entityId': config.payment.Entity_ID_Card,
                'paymentType': 'RF',
                'amount': order.travelerReward,//amount
                'currency': config.payment.Currency
            });
            const options = {
                port: 443,
                host: config.payment.host,
                path: path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': data.length,
                    'Authorization': config.payment.access_token
                }
            };

            let promisDate = new Promise((resolve, reject) => {
                const postRequest = https.request(options, function (res) {
                    const buf = [];
                    res.on('data', chunk => {
                        buf.push(Buffer.from(chunk));
                    });
                    res.on('end', () => {
                        const jsonString = Buffer.concat(buf).toString('utf8');
                        try {
                            resolve(JSON.parse(jsonString));
                        } catch (error) {
                            reject(error);
                        }
                    });
                });
                postRequest.on('error', reject);
                postRequest.write(data);
                postRequest.end();
            });
            let result = await promisDate;
            const success_regex_1 = RegExp(/^(000\.000\.|000\.100\.1|000\.[36])/);
            const success_regex_2 = RegExp(/^(000\.400\.0[^3]|000\.400\.100)/);
            if (success_regex_1.test(result.result.code) || success_regex_2.test(result.result.code)) {
                order.paymentStatus = 'REFUNDED';
                order.deleted = true;
                await order.save();
                response.status(200).send({ message: i18n.__('refundedSuccessfully') });
            } else {
                response.status(400).send(result);
            }
        } catch (error) {
            next(error);
        }
    },

};