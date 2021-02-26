import Promocode from '../../models/promocode.model/promocode.model';
import { body } from 'express-validator/check';
import { checkValidations } from '../shared.controller/shared.controller';
import { checkExistThenGet, checkExist } from '../../helpers/CheckMethods';
import ApiResponse from '../../helpers/ApiResponse';
import { generateVerifyCode } from '../../services/generator-code-service';
import moment from "moment";
import i18n from 'i18n'
import ApiError from '../../helpers/ApiError';
import User from '../../models/user.model/user.model';
import notifiController from '../notif.controller/notif.controller';
import Order from '../../models/order.model/order.model';
import socketEvents from '../../socketEvents'
import config from '../../config';

const populateQuery = [
    { path: 'users', model: 'user' }

];
export default {
    async findAll(req, res, next) {
        try {
            let query = { deleted: false };
            let page = +req.query.page || 1,
                limit = +req.query.limit || 20;
            let skip = (page - 1) * limit;
            let { user, code, from, to, month, year, archive, usersType, numberOfUse, discount, startDate, endDate } = req.query;
            if (archive) query.deleted = true;
            if (usersType) query.usersType = usersType
            if (user) query.$or = [{ users: { $in: user }, usersType: 'SPECIFIC' }, { usersType: 'ALL' }];
            if (numberOfUse) query.numberOfUse = numberOfUse;
            if (discount) query.discount = discount;
            if (startDate) {
                query.startDate = { $gte: new Date(moment(startDate).startOf('day')), $lte: new Date(moment(startDate).endOf('day')) };
            }
            if (endDate) {
                query.endDate = { $gte: new Date(moment(endDate).startOf('day')), $lte: new Date(moment(endDate).endOf('day')) };
            }
            if (code) {
                query.code = code
            }
            if (from) {
                query.startDate = { $gte: from }
            }
            if (to) {
                let date = new Date(to);
                to = moment(date).endOf('day')
                date = new Date(to);
                query.endDate = { $lte: to }
            }
            let date = new Date();
            if (year && !month) {
                date.setFullYear(year);
                let startOfDate = moment(date).startOf('year');
                let endOfDate = moment(date).endOf('year');
                query.createdAt = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) }
            }
            if (month && year) {
                month = month - 1;
                date.setMonth(month);
                date.setFullYear(year);
                let startOfDate = moment(date).startOf('month');
                let endOfDate = moment(date).endOf('month');

                query.createdAt = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) }
            }
            let promocodes = await Promocode.find(query).populate(populateQuery).limit(limit).skip(skip).sort({ _id: -1 });
            promocodes = await Promocode.schema.methods.toJSONLocalizedOnly(promocodes, i18n.getLocale());
            let totalCount = await Promocode.count(query);
            let pageCount = Math.ceil(totalCount / limit);

            res.status(200).send(new ApiResponse(promocodes, page, pageCount, limit, totalCount, req));

        } catch (error) {
            next(error);
        }
    },

    validateBody() {
        let validations = [
            body('code').optional().not().isEmpty().withMessage(() => { return i18n.__('codeRequired') })
                .custom(async (value, { req }) => {
                    let startOfStartDate = moment(req.body.startDate).startOf('day');
                    let endOfEndDate = moment(req.body.endDate).endOf('day');
                    let query = { deleted: false, code: value, $or: [{ startDate: { $gte: new Date(startOfStartDate), $lte: new Date(endOfEndDate) } }, { endDate: { $gte: new Date(startOfStartDate), $lte: new Date(endOfEndDate) } }] }
                    let currentCode = await Promocode.findOne(query);
                    if (currentCode) {
                        return false;
                    }
                }).withMessage(() => { return i18n.__('duplicatedPromoCode') }),
            body('discount').not().isEmpty().withMessage(() => { return i18n.__('discountRequired') }),
            body('startDate').not().isEmpty().withMessage(() => { return i18n.__('startDateRequired') }),
            body('endDate').not().isEmpty().withMessage(() => { return i18n.__('endDateRequired') }),
            body('numberOfUse').not().isEmpty().withMessage(() => { return i18n.__('numberOfUseRequired') }),
            body('usersType').not().isEmpty().withMessage(() => { return i18n.__('usersTypeRequired') }).isIn(['ALL', 'SPECIFIC']).withMessage(() => { return i18n.__('invalidType') }).custom(async (value, { req }) => {
                if (value === 'SPECIFIC') {
                    if (!req.body.users) {
                        throw new Error('Enter the users');
                    }
                    if (req.body.users.length == 0) {
                        throw new Error('Enter the users');
                    }
                }
                return true;
            }),
            body('users').optional().not().isEmpty().withMessage(() => { return i18n.__('usersRequired') }),
            body('users.*').optional().not().isEmpty().withMessage(() => { return i18n.__('usersRequired') }).custom(async (val) => {
                await checkExist(val, User, { deleted: false });
                return true;
            }),
            body('promoCodeType').not().isEmpty().withMessage(() => { return i18n.__('promoCodeTypeRequired') }).isIn(['RATIO', 'VALUE']).withMessage(() => { return i18n.__('invalidType') })
        ]
        return validations;
    },

    async create(req, res, next) {
        try {
            let data = checkValidations(req);
            if (!data.code) {
                data.code = generateVerifyCode();
            }
            data.startDate = moment(data.startDate).startOf('day');
            data.endDate = moment(data.endDate).endOf('day');

            let promocode = await Promocode.create(data);
            let desc = {
                ar: ' لديك كود خصم جديد ' + promocode.code,
                en: ' You have a new discount code ' + promocode.code
            }

            if (promocode.usersType === 'ALL') {
                let users = await User.find({ type: 'CLIENT', deleted: false })
                for (let index = 0; index < users.length; index++) {
                    if (users[index].language == 'ar') {
                        notifiController.pushNotification(users[index]._id, 'PROMOCODE', promocode._id, desc.ar,config.notificationTitle.ar);
                    } else {
                        notifiController.pushNotification(users[index]._id, 'PROMOCODE', promocode._id, desc.en,config.notificationTitle.ar);
                    }
                    notifiController.create(req.user.id, users[index]._id, desc, promocode._id, "PROMOCODE")
                    notificationNSP.to('room-' + users[index].id).emit(socketEvents.NewUser, { user: users[index] });
                }
            } else {
                let users = await User.find({ _id: { $in: promocode.users } }) 
                for (let index = 0; index < users.length; index++) {
                    let user = users[index]
                    if (user && user.language == 'ar') {
                        notifiController.pushNotification(user.id, 'PROMOCODE', promocode._id, desc.ar, config.notificationTitle.ar);
                    } else {
                        notifiController.pushNotification(user.id, 'PROMOCODE', promocode._id, desc.en, config.notificationTitle.ar);
                    }
                    notifiController.create(req.user.id, user.id, desc, promocode._id, "PROMOCODE")
                    notificationNSP.to('room-' + users[index].id).emit(socketEvents.NewUser, { user: users[index] });

                }
            }
            res.status(201).send(promocode);
        } catch (error) {
            next(error);
        }
    },
    async findById(req, res, next) {
        try {
            let id = req.params.id;
            let promocode = await checkExistThenGet(id, Promocode, { deleted: false, populate: populateQuery });
            promocode = await Promocode.schema.methods.toJSONLocalizedOnly(promocode, i18n.getLocale());
            res.status(200).send(promocode);
        } catch (error) {
            next(error);
        }
    },

    async delete(req, res, next) {
        try {
            let id = req.params.id;
            let promocode = await checkExistThenGet(id, Promocode/*, { deleted: false }*/);
            promocode.deleted = true;
            await promocode.save();
            res.status(200).send('Deleted Successfully');
        } catch (error) {
            next(error);
        }
    },
    validateUpdateBody() {
        let validations = [
            body('code').optional().not().isEmpty().withMessage(() => { return i18n.__('codeRequired') }),
            body('discount').optional().not().isEmpty().withMessage(() => { return i18n.__('discountRequired') }),
            body('startDate').optional().not().isEmpty().withMessage(() => { return i18n.__('startDateRequired') }),
            body('endDate').optional().not().isEmpty().withMessage(() => { return i18n.__('endDateRequired') }),
            body('numberOfUse').optional().not().isEmpty().withMessage(() => { return i18n.__('numberOfUseRequired') }),
            body('usersType').optional().not().isEmpty().withMessage(() => { return i18n.__('usersTypeRequired') }).isIn(['ALL', 'SPECIFIC']).withMessage(() => { return i18n.__('invalidType') }).custom(async (value, { req }) => {
                if (value === 'SPECIFIC') {
                    if (!req.body.users) {
                        throw new Error('Enter the users');
                    }
                    if (req.body.users.length == 0) {
                        throw new Error('Enter the users');
                    }
                }
                return true;
            }),
            body('users').optional().not().isEmpty().withMessage(() => { return i18n.__('usersRequired') }),
            body('users.*').optional().not().isEmpty().withMessage(() => { return i18n.__('usersRequired') }).custom(async (val) => {
                await checkExist(val, User, { deleted: false });
                return true;
            }),
        ]
        return validations;
    },
    async update(req, res, next) {
        try {
            let id = req.params.id;
            let promocode = await checkExistThenGet(id, Promocode, { deleted: false });
            let data = checkValidations(req);
            promocode = await Promocode.findOneAndUpdate({ _id: id, deleted: false }, data, { new: true });
            res.status(200).send(promocode);
        } catch (error) {
            next(error);
        }
    },
    validateConfirm() {
        return [
            body('code').not().isEmpty().withMessage(() => { return i18n.__('codeRequired') })
        ]
    },
    async confirmCode(req, res, next) {
        try {
            let user = req.user;
            const code = checkValidations(req).code;
            let currentDate = new Date();
            let query = {
                deleted: false,
                code: code,
                startDate: { $lte: currentDate },
                endDate: { $gte: currentDate },
                $or: [{ usersType: 'ALL' }, { usersType: 'SPECIFIC', users: { $elemMatch: { $eq: user.id } } }]
            };
            //console.log(query)
            let promoCode = await Promocode.findOne(query);
            if (!promoCode) {
                return next(new ApiError(400, i18n.__('promoCodeInvalid')));
            }

            let count = await Order.count({deleted:false, user: user.id, promoCode: promoCode.id });
            if (count >= promoCode.numberOfUse) {
                return next(new ApiError(400, i18n.__('ExccedPromoCodeNumberOuse')));
            }
            notificationNSP.to('room-' + user.id).emit(socketEvents.NewUser, { user: user });

            res.status(200).send(promoCode);
        } catch (error) {
            next(error);
        }
    }
}