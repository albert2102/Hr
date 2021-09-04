import ShippingCard from "../../models/shipping-card.model/shipping-card.model";
import User from "../../models/user.model/user.model";
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
import Company from '../../models/company.model/company.model';

let populateQuery = [{ path: 'user', model: 'user' }];


export default {

    validateBody(isUpdate = false) {
        let validations
        if (!isUpdate) {
            validations = [
                body('type').not().isEmpty().withMessage(() => { return i18n.__('typeRequired') }).isIn(['ORANGE', 'BLUE']).withMessage('Wrong type'),
                body('price').not().isEmpty().withMessage(() => { return i18n.__('priceRequired') }),
                body('value').not().isEmpty().withMessage(() => { return i18n.__('valueRequired') }),
                // body('number').not().isEmpty().withMessage(() => { return i18n.__('numberRequired') })
                //     .isNumeric().withMessage(() => { return i18n.__('invalidNumber') })
                //     .custom(async (val, { req }) => {
                //         let query = { number: val, deleted: false };
                //         let card = await ShippingCard.findOne(query).lean();
                //         if (card)
                //             throw new Error(i18n.__('numberDublicated'));
                //         return true;
                //     })
            ];
        }
        else {
            validations = [
                body('type').optional().not().isEmpty().withMessage(() => { return i18n.__('typeRequired') }).isIn(['ORANGE', 'BLUE']).withMessage('Wrong type'),
                body('price').optional().not().isEmpty().withMessage(() => { return i18n.__('priceRequired') }),
                body('value').optional().not().isEmpty().withMessage(() => { return i18n.__('valueRequired') }),
                // body('number').optional().not().isEmpty().withMessage(() => { return i18n.__('numberRequired') })
                // .isNumeric().withMessage(() => { return i18n.__('invalidNumber') })
                //     .custom(async (val, { req }) => {
                //         let query = { number: val, deleted: false ,_id: { $ne: req.params.shippingCardId }};
                //         let card = await ShippingCard.findOne(query).lean();
                //         if (card)
                //             throw new Error(i18n.__('numberDublicated'));
                //         return true;
                //     })
            ];

        }
        return validations;
    },

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            var { number, price, value, month, year, user, type } = req.query;
            let query = { deleted: false };

            if (type) query.type = type;
            if (user) query.user = user;
            if (number) query.number = { '$regex': number, '$options': 'i' };
            if (price) query.price = price;
            if (value) query.value = value;

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

            let shippingCardes = await ShippingCard.find(query).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit).populate(populateQuery)
            const shippingCardCount = await ShippingCard.count(query);
            let pageCount = Math.ceil(shippingCardCount / limit);
            shippingCardes = ShippingCard.schema.methods.toJSONLocalizedOnly(shippingCardes, i18n.getLocale());

            res.send(new ApiResponse(shippingCardes, page, pageCount, limit, shippingCardCount, req));

        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, i18n.__('unauthrized')));

            let validatedBody = checkValidations(req);
            validatedBody.createdBy = user.id;
            let shippingCard = await ShippingCard.create(validatedBody);

            ///////////////////////////////////////////////////////////////////
            let shippingCardId = shippingCard.id;
            let generateCodeLength = 15 - shippingCardId.toString().length;
            shippingCard.number = generateVerifyCode(generateCodeLength) + shippingCardId;
            ///////////////////////////////////////////////////////////////////
            await shippingCard.save();
            shippingCard = await ShippingCard.populate(shippingCard, populateQuery);
            shippingCard = ShippingCard.schema.methods.toJSONLocalizedOnly(shippingCard, i18n.getLocale());
            res.status(200).send({ shippingCard });
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let { shippingCardId } = req.params;
            await checkExist(shippingCardId, ShippingCard, { deleted: false });
            let validatedBody = checkValidations(req);
            let updatedshippingCard = await ShippingCard.findByIdAndUpdate(shippingCardId, validatedBody, { new: true }).populate(populateQuery);
            updatedshippingCard = ShippingCard.schema.methods.toJSONLocalizedOnly(updatedshippingCard, i18n.getLocale());
            res.status(200).send({ shippingCard: updatedshippingCard });
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { shippingCardId } = req.params;
            let shippingCard = await checkExistThenGet(shippingCardId, ShippingCard, { deleted: false, populate: populateQuery });

            shippingCard = ShippingCard.schema.methods.toJSONLocalizedOnly(shippingCard, i18n.getLocale());

            res.status(200).send({ shippingCard });

        } catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, i18n.__('unauthrized')));

            let { shippingCardId } = req.params;
            let shippingCard = await checkExistThenGet(shippingCardId, ShippingCard, { deleted: false });
            shippingCard.deleted = true;
            await shippingCard.save();
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    },

    validateMulti() {
        return [
            body('price').not().isEmpty().withMessage(() => { return i18n.__('priceRequired') }),
            body('value').not().isEmpty().withMessage(() => { return i18n.__('valueRequired') }),
            body('count').not().isEmpty().withMessage(() => { return i18n.__('countRequired') }).isNumeric().withMessage('must be numeric'),
            body('type').not().isEmpty().withMessage(() => { return i18n.__('typeRequired') }).isIn(['ORANGE', 'BLUE']).withMessage('Wrong type'),
        ];
    },

    async createMulti(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN')
                return next(new ApiError(403, i18n.__('unauthrized')));

            let validatedBody = checkValidations(req);
            validatedBody.createdBy = user.id;
            for (let index = 0; index < validatedBody.count; index++) {
                let shippingCard = await ShippingCard.create(validatedBody);
                ///////////////////////////////////////////////////////////////////
                let shippingCardId = shippingCard.id;
                let generateCodeLength = 15 - shippingCardId.toString().length;
                shippingCard.number = generateVerifyCode(generateCodeLength) + shippingCardId;
                ///////////////////////////////////////////////////////////////////
                await shippingCard.save();
            }
            res.status(200).send("Done");
        } catch (err) {
            next(err);
        }
    },
    //////////////////////////////////////////////////////////////////////////////
    validateUseCard() {
        return [
            body('number').not().isEmpty().withMessage(() => { return i18n.__('numberRequired') })
                .custom(async (val, { req }) => {
                    await checkExist(val, ShippingCard, { deleted: false,number:val},i18n.__('invalidCard'));
                    let query = { number: val, deleted: false, used: true };
                    req.card = await ShippingCard.findOne(query).lean();
                    if (req.card)
                        throw new Error(i18n.__('invalidCard'));
                    return true;
                })
        ];
    },
    async useCard(req, res, next) {
        try {
            let validatedBody = checkValidations(req);

            let user = req.user;
            let shippingCard = await ShippingCard.findOne({ number: validatedBody.number })
            shippingCard.user = user.id;
            shippingCard.used = true;
            shippingCard.usedDate = new Date();
            await shippingCard.save();
            /////////////////////////////////////////////////////////
            user.wallet = user.wallet + shippingCard.value;
            await user.save();
            res.status(200).send({ user: user });

            if (user.type == 'DRIVER') {
                let currentAmount = user.currentAppAmount + Number(shippingCard.value);
            
                let comapny = await Company.findOne({ deleted: false });
        
                if (currentAmount > Number(comapny.driverDuesToStop)) {
                    user.stopReceiveOrders = false;
                    user.currentAppAmount = currentAmount;
                }
                await user.save();

            }
            notificationNSP.to('room-' + user.id).emit(socketEvents.NewUser, { user: user });

        } catch (err) {
            next(err);
        }
    },

    //////////////////////////////////////////////////////////////////////////////
    validateAdminAddToWallet() {
        return [
            body('value').not().isEmpty().withMessage(() => { return i18n.__('numberRequired') }).isNumeric().withMessage('must be a numeric'),
            body('userId').not().isEmpty().withMessage(() => { return i18n.__('userIdRequired') })

        ];
    },
    async adminAddToWallet(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            let authUser = req.user;

            if (authUser.type != 'ADMIN' && authUser.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('admin.auth')));
            }
            let user = await checkExistThenGet(validatedBody.userId, User, { deleted: false });

            user.wallet = user.wallet + validatedBody.value;
            await user.save();
            res.status(200).send({ user: user });

            let description = { ar: ' تم  إضافة  مبلغ بمحفظتك بقيمة' + ' : ' + validatedBody.value, en: 'This amount has been added to your wallet : ' + validatedBody.value };
            await notifyController.create(req.user.id, user.id, description, user.id, 'ADDED_TO_WALLET');
            notifyController.pushNotification(user.id, 'ADDED_TO_WALLET', user.id, description);
            notificationNSP.to('room-' + user.id).emit(socketEvents.NewUser, { user: user });
        } catch (err) {
            next(err);
        }
    },

    //////////////////////////////////////////////////////////////////////////////
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
            await ShippingCard.updateMany({ _id: { $in: validatedBody.ids }, deleted: false }, { deleted: true, deletedDate: new Date() })
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    },
}