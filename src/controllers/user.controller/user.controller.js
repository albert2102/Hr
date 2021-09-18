import bcrypt from 'bcryptjs';
import { body } from 'express-validator/check';
import { checkValidations, handleImg, fieldhandleImg } from '../shared.controller/shared.controller';
import { generateToken } from '../../utils/token';
import User from '../../models/user.model/user.model';
import { checkExistThenGet, checkExist } from '../../helpers/CheckMethods';
import ApiError from '../../helpers/ApiError';
import ConfirmationCode from '../../models/confirmationsCodes.model/confirmationscodes.model'
import { sendEmail } from '../../services/emailMessage.service'
import Hash from "../../models/hash.model/hash.model"
import i18n from 'i18n'
import ApiResponse from '../../helpers/ApiResponse'
import moment from 'moment'
import socketEvents from '../../socketEvents'
import { twilioSend, twilioVerify } from '../../services/twilo'
import checkValidCoordinates from 'is-valid-coordinates';
import NotificationController from '../notif.controller/notif.controller';
import Address from '../../models/address.model/address.model';
import Product from '../../models/product.model/product.model';
import AdminController from '../admin.controller/admin.controller';
import Category from '../../models/category.model/category.model';
import Country from "../../models/country.model/country.model";
import City from "../../models/city.model/city.model";
import Region from "../../models/region.model/region.model";

const checkUserExistByEmail = async (email) => {
    let user = await User.findOne({ email, deleted: false });
    if (!user)
        throw new ApiError.BadRequest('email Not Found');
    return user;
}
let populateQuery = [
    { path: 'rules', model: 'assignRule' },
    { path: 'category', model: 'category' },
    { path: 'country', model: 'country' },
    { path: 'city', model: 'city', populate: { path: 'country', model: 'country' } },
    { path: 'region', model: 'region', populate: [{ path: 'city', model: 'city', populate: { path: 'country', model: 'country' } }] }

];

export default {

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1,
                limit = +req.query.limit || 20;
            var { all, name, type, fromDate, toDate, phone, email, activated, countryKey, countryCode,
                month, year, day, archive, country, category, status } = req.query;

            var query = { deleted: false, status: { $nin: ['WAITING', 'REJECTED'] } };
            if (archive) query.deleted = true;
            if (status) query.status = status;
            if (name) query.name = { '$regex': name, '$options': 'i' };
            if (phone) query.phone = { '$regex': phone, '$options': 'i' };
            if (email) query.email = { '$regex': email, '$options': 'i' };
            if (type) query.type = type;
            if (activated) query.activated = activated;
            if (countryKey) query.countryKey = countryKey;
            if (countryCode) query.countryCode = countryCode;
            if (country) query.country = country;
            if (category) query.category = category;

            if (fromDate && toDate) {
                let startOfDate = moment(fromDate).startOf('day');
                let endOfDate = moment(toDate).endOf('day');
                query.createdAt = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) };
            } else if (toDate && !fromDate) {
                let endOfDate = moment(toDate).endOf('day');
                query.createdAt = { $lte: new Date(endOfDate) };
            } else if (fromDate && !toDate) {
                let startOfDate = moment(fromDate).startOf('day');
                query.createdAt = { $gte: new Date(startOfDate) };
            }

            let date = new Date();
            if (month && year && !day) {
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
            if (month && year && day) {
                month = month - 1;
                date.setMonth(month);
                date.setFullYear(year);
                date.setDate(day);
                let startOfDay = moment(date).startOf('day');
                let endOfDay = moment(date).endOf('day');
                query.createdAt = { $gte: new Date(startOfDay), $lte: new Date(endOfDay) }
            }
            let users;
            let pageCount;
            const userCount = await User.count(query);
            if (all) {
                users = await User.find(query).populate(populateQuery).sort({ _id: -1 });
                pageCount = 1;
            } else {
                users = await User.find(query).populate(populateQuery).sort({ _id: -1 }).limit(limit).skip((page - 1) * limit);
                pageCount = Math.ceil(userCount / limit);
            }

            users = User.schema.methods.toJSONLocalizedOnly(users, i18n.getLocale());
            res.send(new ApiResponse(users, page, pageCount, limit, userCount, req));
        } catch (error) {
            next(error)
        }
    },

    validateUserSignin() {
        let validations = [
            body('countryCode').not().isEmpty().withMessage(() => { return i18n.__('countryCodeRequired') }),
            body('phone').not().isEmpty().withMessage(() => { return i18n.__('usernameOrPhoneRequired') }),
            body('password').not().isEmpty().withMessage(() => { return i18n.__('passwordRequired') }),
            body('type').not().isEmpty().withMessage(() => { return i18n.__('typeIsRequired') })
                .isIn(['CLIENT', 'INSTITUTION', 'DRIVER']).withMessage(() => { return i18n.__('userTypeWrong') }),
        ];
        return validations;
    },

    async signIn(req, res, next) {
        try {
            const validatedBody = checkValidations(req);
            var query = { deleted: false, type: validatedBody.type, activated: true, socialMediaType: 'NORMAL' };
            // if (validatedBody.type != 'CLIENT') query.status = 'ACCEPTED';
            if (validatedBody.countryCode) query.countryCode = validatedBody.countryCode;
            query.phone = validatedBody.phone.trim();
            let user = await User.findOne(query).populate(populateQuery);
            if (user) {
                await user.isValidPassword(validatedBody.password, async function (err, isMatch) {
                    if (err) {
                        next(err)
                    } else if (isMatch) {
                        if (!user.activated) {
                            return next(new ApiError(403, i18n.__('accountStop')));
                        }

                        user = await User.schema.methods.toJSONLocalizedOnly(user, i18n.getLocale());
                        return res.status(200).send({ user, token: generateToken(user.id) });
                    } else {
                        return next(new ApiError(400, i18n.__('passwordInvalid')));
                    }
                })
            } else {
                return next(new ApiError(403, i18n.__('userNotFound')));
            }
        } catch (err) {
            next(err);
        }
    },

    validateUserCreateBody() {
        let validations = [
            body('name').not().isEmpty().withMessage(() => { return i18n.__('nameRequired') })
                .custom(async (value, { req }) => {
                    value = (value.trim());
                    let userQuery = { username: value, deleted: false };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('usernameDuplicated'));
                    return true;
                }),
            body('email').optional().trim().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') })
                .isEmail().withMessage(() => { return i18n.__('EmailNotValid') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { email: value, deleted: false, type: 'CLIENT' };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('emailDuplicated'));
                    return true;
                }),
            body('password').not().isEmpty().withMessage(() => { return i18n.__('passwordRequired') }),
            body('phone').not().isEmpty().withMessage(() => { return i18n.__('PhoneIsRequired') }).custom(async (value, { req }) => {
                value = (value.trim()).toLowerCase();
                let userQuery = { phone: value, deleted: false, type: 'CLIENT' };
                if (await User.findOne(userQuery))
                    throw new Error(i18n.__('phoneDuplicated'));
                return true;
            }),
            body('countryCode').not().isEmpty().withMessage(() => { return i18n.__('countryCodeRequired') }),
            body('countryKey').not().isEmpty().withMessage(() => { return i18n.__('countryKeyRequired') }),
            body('country').optional().not().isEmpty().withMessage(() => { return i18n.__('countryRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, Country, { deleted: false })
                    return true;
                }),
            body('city').optional().not().isEmpty().withMessage(() => { return i18n.__('cityRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, City, { deleted: false })
                    return true;
                }),
            body('region').optional().not().isEmpty().withMessage(() => { return i18n.__('regionRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, Region, { deleted: false })
                    return true;
                }),
        ];
        return validations;
    },

    async userSignUp(req, res, next) {
        try {
            const validatedBody = checkValidations(req);
            if (validatedBody.email)
                validatedBody.email = (validatedBody.email.trim()).toLowerCase();

            if (req.file) {
                let image = await handleImg(req, { attributeName: 'image', isUpdate: false });
                validatedBody.image = image;
            }

            let createdUser = await User.create(validatedBody);
            res.status(200).send({ user: createdUser, token: generateToken(createdUser.id) })
            adminNSP.to('room-admin').emit(socketEvents.NewSignup, { user: createdUser });

        } catch (err) {
            next(err);
        }
    },

    validateCheckPhone() {
        return [
            body('phone').not().isEmpty().withMessage(() => { return i18n.__('PhoneIsRequired') })
        ]
    },
    async checkExistPhone(req, res, next) {
        try {
            let phone = checkValidations(req).phone;
            let exist = await User.findOne({ phone: phone, deleted: false });
            return res.status(200).send({ duplicated: exist ? true : false });
        } catch (error) {
            next(error);
        }
    },

    validateCheckEmail() {
        return [
            body('email').trim().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') })
        ]
    },
    async checkExistEmail(req, res, next) {
        try {
            let email = checkValidations(req).email.toLowerCase();
            let exist = await User.findOne({ email: email, deleted: false });
            return res.status(200).send({ duplicated: exist ? true : false });
        } catch (error) {
            next(error);
        }
    },

    validateUserUpdate() {
        let validations = [
            body('name').optional().not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
            body('email').optional().trim().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') })
                .isEmail().withMessage(() => { return i18n.__('Email Not Valid') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { _id: { $ne: req.user.id }, email: value, deleted: false, type: 'CLIENT' };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('emailDuplicated'));
                    else
                        return true;
                }),
            body('phone').optional().not().isEmpty().withMessage(() => { return i18n.__('PhoneIsRequired') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { _id: { $ne: req.user.id }, phone: value, deleted: false, type: 'CLIENT' };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('phoneDuplicated'));
                    else
                        return true;
                }),
            body('language').optional().not().isEmpty().withMessage(() => { return i18n.__('languageRequired') }).isIn(['ar', 'en']),
            body('notification').optional().not().isEmpty().withMessage(() => { return i18n.__('notificationRequired') }),
            body('newPassword').optional().not().isEmpty().withMessage(() => { return i18n.__('newPasswordRequired') }),
            body('currentPassword').optional().not().isEmpty().withMessage(() => { return i18n.__('CurrentPasswordRequired') }),
            body('countryCode').optional().not().isEmpty().withMessage(() => { return i18n.__('countryCodeRequired') }),
            body('countryKey').optional().not().isEmpty().withMessage(() => { return i18n.__('countryKeyRequired') }),

            body('location').optional().not().isEmpty().withMessage(() => { return i18n.__('locationRequired') }),
            body('location.long').optional().not().isEmpty().withMessage(() => { return i18n.__('longitudeRequired') }),
            body('location.lat').optional().not().isEmpty().withMessage(() => { return i18n.__('latitudeRequired') }),
            body('country').optional().not().isEmpty().withMessage(() => { return i18n.__('countryRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, Country, { deleted: false })
                    return true;
                }),
            body('city').optional().not().isEmpty().withMessage(() => { return i18n.__('cityRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, City, { deleted: false })
                    return true;
                }),
            body('region').optional().not().isEmpty().withMessage(() => { return i18n.__('regionRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, Region, { deleted: false })
                    return true;
                }),
        ];

        return validations;
    },
    async updateInfo(req, res, next) {
        try {
            let userId = req.user.id;
            let validatedBody = checkValidations(req);
            let user = await checkExistThenGet(userId, User, { deleted: false });
            if (validatedBody.email) {
                validatedBody.email = (validatedBody.email.trim()).toLowerCase();
            }
            if (req.files && req.files['image'] && req.files['image'].length > 0) {
                validatedBody.image = (fieldhandleImg(req, { attributeName: 'image' }))[0];
            }
            if (req.files && req.files['coverImage'] && req.files['coverImage'].length > 0) {
                let coverImage = fieldhandleImg(req, { attributeName: 'coverImage' });
                validatedBody.coverImage = coverImage[0];
            }
            if (validatedBody.location && validatedBody.location.lat && validatedBody.location.lat) {
                validatedBody.geoLocation = { type: 'Point', coordinates: [validatedBody.location.long, validatedBody.location.lat] }
            }
            if (validatedBody.newPassword) {

                if (validatedBody.currentPassword) {
                    if (bcrypt.compareSync(validatedBody.currentPassword, user.password)) {
                        const salt = bcrypt.genSaltSync();
                        var hash = await bcrypt.hash(validatedBody.newPassword, salt);
                        validatedBody.password = hash;
                        delete validatedBody.newPassword;
                        delete validatedBody.currentPassword;
                        user = await User.findOneAndUpdate({ deleted: false, _id: userId }, validatedBody, { new: true }).populate(populateQuery);
                        user = await User.schema.methods.toJSONLocalizedOnly(user, i18n.getLocale());

                        res.status(200).send(user);
                        if (user.type == 'INSTITUTION') {
                            notificationNSP.emit(socketEvents.UpdatedTrader, { user: user });
                        }
                    } else {
                        return next(new ApiError(403, i18n.__('currentPasswordInvalid')))
                    }
                } else {
                    return res.status(400).send({
                        error: [{
                            location: 'body',
                            param: 'currentPassword',
                            msg: i18n.__('CurrentPasswordRequired')
                        }]
                    });
                }
            } else {
                user = await User.findOneAndUpdate({ deleted: false, _id: userId }, validatedBody, { new: true }).populate(populateQuery);
                user = await User.schema.methods.toJSONLocalizedOnly(user, i18n.getLocale());

                res.status(200).send(user);
                if (user.type == 'INSTITUTION' && validatedBody.institutionStatus) {
                    notificationNSP.emit(socketEvents.UpdatedTrader, { user: user });
                }
            }

        } catch (error) {
            next(error);
        }
    },

    validateUpdatedPassword() {
        let validation = [
            body('newPassword').not().isEmpty().withMessage(() => { return i18n.__('newPasswordRequired') }),
            body('currentPassword').not().isEmpty().withMessage(() => { return i18n.__('CurrentPasswordRequired') }),
        ];
        return validation;
    },
    async updatePasswordFromProfile(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            let user = req.user;
            if (bcrypt.compareSync(validatedBody.currentPassword, user.password)) {
                const salt = bcrypt.genSaltSync();
                var hash = await bcrypt.hash(validatedBody.newPassword, salt);
                validatedBody.password = hash;
                delete validatedBody.newPassword;
                delete validatedBody.currentPassword;
                user = await User.findOneAndUpdate({ deleted: false, _id: user.id }, validatedBody, { new: true }).populate(populateQuery);
                res.status(200).send({ user: user });
            } else {
                return next(new ApiError(403, i18n.__('currentPasswordInvalid')))
            }
        } catch (error) {
            next(error);
        }
    },

    /////////////////////////////////////////////////////////////////////////////////////////// forget password by email
    validateForgetPassword() {
        return [
            body('email').not().isEmpty().withMessage(() => { return i18n.__('emailRequired') }),
            body('type').not().isEmpty().withMessage(() => { return i18n.__('typeIsRequired') })
                .isIn(['ADMIN', 'SUB_ADMIN', 'CLIENT', 'INSTITUTION', 'DRIVER']).withMessage(() => { return i18n.__('userTypeWrong') }),
        ];
    },
    async forgetPassword(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            var email = validatedBody.email;
            email = (email.trim()).toLowerCase();
            console.log(email)
            var user = await User.findOne({ email: email, deleted: false, type: validatedBody.type });
            if (!user)
                return next(new ApiError(403, i18n.__('EmailNotFound')));
            var randomCode = '' + (Math.floor(1000 + Math.random() * 9000));
            var code = new ConfirmationCode({ email: email, code: randomCode });
            await code.save();
            var text = 'Enter This Code To Change Your Password ' + randomCode + ' .';
            await sendEmail(email, text);

            res.status(200).send(i18n.__('checkYourMail'));
        } catch (err) {
            next(err);
        }
    },

    validateConfirmCode() {
        return [
            body('email').not().isEmpty().withMessage(() => { return i18n.__('emailRequired') }),
            body('code').not().isEmpty().withMessage(() => { return i18n.__('codeRequired') }),
            body('type').not().isEmpty().withMessage(() => { return i18n.__('typeIsRequired') })
                .isIn(['ADMIN', 'SUB_ADMIN', 'CLIENT', 'INSTITUTION', 'DRIVER']).withMessage(() => { return i18n.__('userTypeWrong') }),
        ];
    },
    async verifyForgetPasswordCode(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            var email = validatedBody.email;
            var code = validatedBody.code;
            email = (email.trim()).toLowerCase();
            var user = await ConfirmationCode.findOne({ code, email });

            if (user) {
                await ConfirmationCode.remove({ code, email });
                res.status(200).send(i18n.__('CodeSuccess'));
            } else
                res.status(400).send(i18n.__('CodeFail'));
        } catch (err) {
            next(err);
        }
    },

    async updatePassword(req, res, next) {
        try {
            let validatedBody = checkValidations(req)
            validatedBody.email = (validatedBody.email.trim()).toLowerCase();
            const salt = bcrypt.genSaltSync();
            var hash = await bcrypt.hash(validatedBody.newPassword, salt);
            var password = hash;
            var user = await User.findOneAndUpdate({ email: validatedBody.email, deleted: false, type: validatedBody.type }, { password: password }, { new: true }).populate(populateQuery);
            if (user) {
                res.status(200).send({
                    user,
                    token: generateToken(user.id)
                });
            } else
                res.status(404).send(i18n.__('EmailNotFound'));
        } catch (err) {
            next(err);
        }
    },
    ////////////////////////////////////////////////////////////////////////// forget password by phone
    validateForgetPasswordByPhone() {
        return [
            body('countryCode').not().isEmpty().withMessage(() => { return i18n.__('countryCodeRequired') }),
            body('phone').not().isEmpty().withMessage(() => { return i18n.__('phoneRequired') }),
            body('type').not().isEmpty().withMessage(() => { return i18n.__('typeIsRequired') })
                .isIn(['ADMIN', 'SUB_ADMIN', 'CLIENT', 'INSTITUTION', 'DRIVER']).withMessage(() => { return i18n.__('userTypeWrong') }),
        ];
    },
    async forgetPasswordByPhone(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            var phone = validatedBody.phone;
            phone = phone.trim()
            var user = await User.findOne({ phone: phone, deleted: false, type: validatedBody.type, countryCode: validatedBody.countryCode });
            if (!user)
                return next(new ApiError(403, i18n.__('userNotFound')));
            let countryCode = '+2';
            if (user.countryCode != '20') {
                countryCode = '+' + user.countryCode;
            }
            twilioSend(countryCode + phone, user.language || 'ar');
            res.status(200).send(i18n.__('checkYourPhone'));
        } catch (err) {
            next(err);
        }
    },

    validateVerifyForgetPasswordByPhone() {
        return [
            body('code').not().isEmpty().withMessage(() => { return i18n.__('codeRequired') }),
            body('phone').not().isEmpty().withMessage(() => { return i18n.__('phoneRequired') }),
            body('countryCode').not().isEmpty().withMessage(() => { return i18n.__('countryCodeRequired') }),
            body('type').not().isEmpty().withMessage(() => { return i18n.__('typeIsRequired') })
                .isIn(['ADMIN', 'SUB_ADMIN', 'CLIENT', 'INSTITUTION', 'DRIVER']).withMessage(() => { return i18n.__('userTypeWrong') }),
        ];
    },
    async verifyForgetPasswordByPhone(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            var phone = validatedBody.phone;
            phone = phone.trim()
            var user = await User.findOne({ phone: phone, deleted: false, type: validatedBody.type, countryCode: validatedBody.countryCode });
            if (!user)
                return next(new ApiError(403, i18n.__('userNotFound')));
            twilioVerify('+' + user.countryCode + phone, validatedBody.code, user, res, next);
        } catch (err) {
            next(err);
        }
    },

    validateUpdatePasswordByPhone() {
        return [
            body('password').not().isEmpty().withMessage(() => { return i18n.__('passwordRequired ') }),
            body('phone').not().isEmpty().withMessage(() => { return i18n.__('phoneRequired') }),
            body('countryCode').not().isEmpty().withMessage(() => { return i18n.__('countryCodeRequired') }),
            body('type').not().isEmpty().withMessage(() => { return i18n.__('typeIsRequired') })
                .isIn(['ADMIN', 'SUB_ADMIN', 'CLIENT', 'INSTITUTION', 'DRIVER']).withMessage(() => { return i18n.__('userTypeWrong') }),
        ];
    },
    async updatePasswordByPhone(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            validatedBody.phone = validatedBody.phone.trim();
            let user = await User.findOne({ deleted: false, phone: validatedBody.phone, type: validatedBody.type, countryCode: validatedBody.countryCode });
            if (!user) {
                return next(new ApiError(403, i18n.__('userNotFound')));
            }
            user.password = validatedBody.password;
            await user.save();
            res.status(200).send({
                user,
                token: generateToken(user.id)
            });
        } catch (err) {
            next(err);
        }
    },
    ////////////////////////////////////////////////////////////////////////////////////////// reset password

    validateResetPassword() {
        return [
            body('email').not().isEmpty().withMessage(() => { return i18n.__('emailRequired') }),
            body('newPassword').not().isEmpty().withMessage(() => { return i18n.__('newPasswordRequired') }),
            body('type').not().isEmpty().withMessage(() => { return i18n.__('typeIsRequired') }).isIn(['ADMIN', 'SUB_ADMIN', 'CLIENT', 'INSTITUTION', 'DRIVER']).withMessage(() => { return i18n.__('userTypeWrong') }),
        ];
    },

    async resetPassword(req, res, next) {
        try {

            let validatedBody = checkValidations(req);
            let user = await checkUserExistByEmail(validatedBody.email);

            user.password = validatedBody.newPassword;

            await user.save();

            await reportController.create({ "ar": 'تغير الرقم السري لمستخدم ', "en": "Change Password" }, 'UPDATE', req.user.id);

            res.status(200).send();

        } catch (err) {
            next(err);
        }
    },

    ////////////////////////////////////////////////////////////////////////////////////////// 
    validateAddToken() {
        let validations = [
            body('token').not().isEmpty().withMessage(() => { return i18n.__('token is required') }),
            body('type').not().isEmpty().withMessage(() => { return i18n.__('type is required') })
                .isIn(['ios', 'android', 'web']).withMessage(() => { return i18n.__('wrong type') })
        ];
        return validations;
    },
    async addToken(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            let user = await checkExistThenGet(req.user.id, User, { deleted: false });
            let tokens = user.tokens;
            let found = false;
            for (let index = 0; index < tokens.length; index++) {
                if (tokens[index].token == validatedBody.token) {
                    found = true
                }
            }
            if (!found) {
                user.tokens.push(validatedBody);
                var q = {
                    token: validatedBody.token,
                    deleted: false
                }
                var doc = await Hash.findOne(q);
                if (doc) {
                    if (req.user.id != doc.user) {
                        var newdoc = await Hash.findOneAndUpdate(q, { user: req.user.id });
                        var newUser = await User.findByIdAndUpdate(doc.user, { $pull: { tokens: { token: validatedBody.token } } }, { new: true });
                    }
                } else {
                    await Hash.create({ token: validatedBody.token, user: req.user.id });
                }
                await user.save();
            }
            res.status(200).send({ user });
        } catch (err) {
            next(err);
        }
    },

    validateLogout() {
        return [
            body('token').not().isEmpty().withMessage('tokenRequired')
        ];
    },
    async logout(req, res, next) {
        try {
            let token = req.body.token;
            let user = await checkExistThenGet(req.user._id, User, { deleted: false });

            let tokens = [];
            for (let i = 0; i < user.tokens.length; i++) {
                if (user.tokens[i].token != token) {
                    tokens.push(user.tokens[i]);
                }
            }
            user.tokens = tokens;
            user.workStatus = 'OFFLINE';
            user.logedIn = false;
            await user.save();
            res.status(200).send(await checkExistThenGet(req.user._id, User, { deleted: false }));
        } catch (err) {
            next(err)
        }
    },

    async userInformation(req, res, next) {
        try {
            let userId = req.query.userId;
            let user = await checkExistThenGet(userId, User, { deleted: false, populate: populateQuery });
            user = await User.schema.methods.toJSONLocalizedOnly(user, i18n.getLocale());
            res.status(200).send({ user: user });
        } catch (error) {
            next(error);
        }
    },
    async deleteAccount(req, res, next) {
        try {
            var user = await checkExistThenGet(req.user.id, User, { deleted: false });
            user.deleted = true;
            await user.save();
            await ConfirmationCode.deleteMany({ email: user.email });
            res.status(200).send('Deleted Successfully');
        } catch (error) {
            next(error);
        }
    },

    async openActiveChatHead(req, res, next) {
        try {
            let user = req.user;
            let newUser = await User.findByIdAndUpdate(user.id, { activeChatHead: true }, { new: true });
            res.status(200).send({ user: newUser });
        } catch (error) {
            next(error);
        }
    },

    async closeActiveChatHead(req, res, next) {
        try {
            let user = req.user;
            let newUser = await User.findByIdAndUpdate(user.id, { activeChatHead: false }, { new: true });
            res.status(200).send({ user: newUser });

        } catch (error) {
            next(error);
        }
    },

    validateDeleteUserAccount() {
        let validations = [
            body('userId').not().isEmpty().withMessage(() => { return i18n.__('userIdRequired') }),
        ];
        return validations;
    },
    async deleteUserAccount(req, res, next) {
        try {
            let userId = checkValidations(req).userId;
            var user = await checkExistThenGet(userId, User, { deleted: false });
            await ConfirmationCode.deleteMany({ email: user.email });
            user.deleted = true;
            await user.save();
            res.status(200).send('Deleted Successfully');
        } catch (error) {
            next(error);
        }
    },

    validateSocialMediaLogin() {
        let validations = [
            body('email').optional().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') }),
            body('phone').optional().not().isEmpty().withMessage(() => { return i18n.__('PhoneIsRequired') }),
            body('name').not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
            body('image').optional().not().isEmpty().withMessage(() => { return i18n.__('imageRequired') }),
            body('socialId').not().isEmpty().withMessage(() => { return i18n.__('socialIdRequired') }),
            body('socialMediaType').not().isEmpty().withMessage(() => { return i18n.__('socialMediaTypeRequired') }).isIn(['FACEBOOK', 'TWITTER', 'INSTAGRAM', 'GOOGLE', 'APPLE']).withMessage(() => { return i18n.__('socialMediaTypeWrong') })
        ];
        return validations;
    },
    async socialMedialLogin(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            let query = { deleted: false, type: 'CLIENT', socialId: validatedBody.socialId };

            if (validatedBody.email) {
                validatedBody.email = (validatedBody.email.trim()).toLowerCase();
                query.email = validatedBody.email;
            }
            let user = await User.findOne(query);
            if (user) {
                if (!user.activated) {
                    return next(new ApiError(403, i18n.__('accountStop')));
                } else {
                    res.status(200).send({ user, token: generateToken(user.id) });
                }
            }
            else {
                let createdUser = await User.create(validatedBody);
                res.status(200).send({ user: createdUser, token: generateToken(createdUser.id) });
            }
        } catch (err) {
            next(err);
        }
    },

    validateVisitorSignUp() {
        let validations = [
            body('token').optional().not().isEmpty().withMessage(() => { return i18n.__('token is required') }),
            body('type').optional().not().isEmpty().withMessage(() => { return i18n.__('type is required') })
                .isIn(['ios', 'android', 'web']).withMessage(() => { return i18n.__('wrong type') })
        ];
        return validations;
    },

    async Home(req, res, next) {
        try {
            let page = +req.query.page || 1,
                limit = +req.query.limit || 20;
            var { text, hasOffer, open, long, lat, category, highestRated, country } = req.query;

            let query = { deleted: false, type: 'INSTITUTION', activated: true };
            let sortQuery = { createdAt: -1 };
            if (country) query.country = country;
            if (open) query.institutionStatus = 'OPEN'; // مفتوح
            if (highestRated) sortQuery = { totalRate: -1 }; //الاعلي تقييما
            if (category) {
                if (Array.isArray(category)) {
                    category = category.map((c) => { return +c })
                    query.category = { $in: category };
                } else if (!isNaN(category)) {
                    query.category = +category;
                }
            }

            if (hasOffer) { // الاوفر
                let tradersOffers = await Product.find({ deleted: false, offer: { $ne: 0 } }).distinct('trader');
                query._id = { $in: tradersOffers }
            }
            if (text) {
                let traders = await Product.find({ deleted: false, $or: [{ 'name.en': { '$regex': text, '$options': 'i' } }, { 'name.ar': { '$regex': text, '$options': 'i' } }] }).distinct('trader')
                query.$or = [{ name: { '$regex': text, '$options': 'i' } }, { _id: { $in: traders } }];
            }
            if (lat && long) {
                limit = 10;
            }
            let aggregateQuery = [
                { $match: query },
                { $sort: sortQuery },
                { $limit: limit },
                { $skip: (page - 1) * limit }];

            if (lat && long) { // الاقرب والابعد
                aggregateQuery.unshift({ $geoNear: { near: { type: "Point", coordinates: [+long, +lat] }, distanceField: "dist.calculated", maxDistance: 10000 } })
            }
            let users = await User.aggregate(aggregateQuery)
            let pageCount;
            const userCount = await User.count(query);
            users = await User.populate(users, populateQuery);
            pageCount = Math.ceil(userCount / limit);
            // users = User.schema.methods.toJSONLocalizedOnly(users, i18n.getLocale());

            res.send(new ApiResponse(users, page, pageCount, limit, userCount, req));
        } catch (error) {
            next(error)
        }
    },
    /////////////////////////////////////////////////////////////////////////////////////////////////////////
    validateUpdateDriver() {
        let validations = [
            body('name').optional().not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
            body('email').optional().trim().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') })
                .isEmail().withMessage(() => { return i18n.__('EmailNotValid') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { email: value, deleted: false, _id: { $ne: req.body.userId } };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('emailDuplicated'));
                    else
                        return true;
                }),
            body('password').optional().not().isEmpty().withMessage(() => { return i18n.__('passwordRequired') }),
            body('phone').optional().not().isEmpty().withMessage(() => { return i18n.__('PhoneIsRequired') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { phone: value, deleted: false, _id: { $ne: req.body.userId } };

                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('phoneIsDuplicated'));
                    else
                        return true;
                }),
            body('language').optional().not().isEmpty().withMessage(() => { return i18n.__('languageRequired') }),
            body('notification').optional().not().isEmpty().withMessage(() => { return i18n.__('notificationRequired') }),
            body('countryCode').optional().not().isEmpty().withMessage(() => { return i18n.__('countryCodeRequired') }),
            body('countryKey').optional().not().isEmpty().withMessage(() => { return i18n.__('countryKeyRequired') }),
            body('nationalIdImage').optional().not().isEmpty().withMessage(() => { return i18n.__('nationalIdImageRequired') }),
            body('frontCarLicenceImage').optional().not().isEmpty().withMessage(() => { return i18n.__('frontCarLicenceImageRequired') }),
            body('backCarLicenceImage').optional().not().isEmpty().withMessage(() => { return i18n.__('backCarLicenceImageRequired') }),
            body('insideCarImage').optional().not().isEmpty().withMessage(() => { return i18n.__('insideCarImageRequired') }),
            body('frontDriverLicenceImage').optional().not().isEmpty().withMessage(() => { return i18n.__('frontDriverLicenceImageRequired') }),
            body('backDriverLicenceImage').optional().not().isEmpty().withMessage(() => { return i18n.__('backDriverLicenceImageRequired') }),
            body('internallyCarImage').optional().not().isEmpty().withMessage(() => { return i18n.__('internallyCarImageRequired') }).isArray().withMessage('must be an array'),
            body('frontCarImage').optional().not().isEmpty().withMessage(() => { return i18n.__('frontCarImageRequired') }),
            body('backCarImage').optional().not().isEmpty().withMessage(() => { return i18n.__('backCarImageRequired') }),
            body('frontCarPlateImage').optional().not().isEmpty().withMessage(() => { return i18n.__('frontCarPlateImageRequired') }),
            body('backCarPlateImage').optional().not().isEmpty().withMessage(() => { return i18n.__('backCarPlateImageRequired') }),
            // body('carPlateWithYouImage').optional().not().isEmpty().withMessage(() => { return i18n.__('carPlateWithYouImageRequired') }),
            body('carInsuranceImage').optional().not().isEmpty().withMessage(() => { return i18n.__('carInsuranceImageRequired') }),
            body('carFormImage').optional().not().isEmpty().withMessage(() => { return i18n.__('carFormImageRequired') }),
            body('ibanNumber').optional().not().isEmpty().withMessage(() => { return i18n.__('ibanNumberRequired') }),
            body('coverImage').optional().not().isEmpty().withMessage(() => { return i18n.__('coverImageRequired') }),

            body('online').optional().not().isEmpty().withMessage(() => { return i18n.__('openChatRequired') }).isBoolean().withMessage('must be boolean'),
            body('openLocation').optional().not().isEmpty().withMessage(() => { return i18n.__('openChatRequired') }).isBoolean().withMessage('must be boolean'),
            body('country').optional().not().isEmpty().withMessage(() => { return i18n.__('countryRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, Country, { deleted: false })
                    return true;
                }),
            body('city').optional().not().isEmpty().withMessage(() => { return i18n.__('cityRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, City, { deleted: false })
                    return true;
                }),
            body('region').optional().not().isEmpty().withMessage(() => { return i18n.__('regionRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, Region, { deleted: false })
                    return true;
                }),
        ];

        return validations;
    },


    validateUpdateInstitution() {
        let validations = [
            body('name').optional().not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
            body('email').optional().trim().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') })
                .isEmail().withMessage(() => { return i18n.__('EmailNotValid') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { email: value, deleted: false, _id: { $ne: req.body.userId }, type: 'INSTITUTION' };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('emailDuplicated'));
                    else
                        return true;
                }),
            body('password').optional().not().isEmpty().withMessage(() => { return i18n.__('passwordRequired') }),
            body('phone').optional().not().isEmpty().withMessage(() => { return i18n.__('PhoneIsRequired') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { phone: value, deleted: false, _id: { $ne: req.body.userId }, type: 'INSTITUTION' };

                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('phoneIsDuplicated'));
                    else
                        return true;
                }),
            body('language').optional().not().isEmpty().withMessage(() => { return i18n.__('languageRequired') }),
            body('notification').optional().not().isEmpty().withMessage(() => { return i18n.__('notificationRequired') }),
            body('countryCode').optional().not().isEmpty().withMessage(() => { return i18n.__('countryCodeRequired') }),
            body('countryKey').optional().not().isEmpty().withMessage(() => { return i18n.__('countryKeyRequired') }),

            body('commercialRegister').optional().not().isEmpty().withMessage(() => { return i18n.__('commercialRegisterRequired') }),
            body('ibanNumber').optional().not().isEmpty().withMessage(() => { return i18n.__('ibanNumberRequired') }),
            body('category').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryRequired') }).custom(async (val, { req }) => {
                await checkExist(val, Category, { deleted: false });
                return true;
            }),
            body('responsibleName').optional().not().isEmpty().withMessage(() => { return i18n.__('responsibleNameRequired') }),
            body('location').optional().not().isEmpty().withMessage(() => { return i18n.__('locationRequired') }),
            body('location.long').optional().not().isEmpty().withMessage(() => { return i18n.__('longitudeRequired') }),
            body('location.lat').optional().not().isEmpty().withMessage(() => { return i18n.__('latitudeRequired') }),

            body('address').optional().not().isEmpty().withMessage(() => { return i18n.__('addressRequired') }),
            body('workingTimeText').optional().not().isEmpty().withMessage(() => { return i18n.__('workingTimeTextRequired') }),
            body('paymentMethod').optional().not().isEmpty().withMessage(() => { return i18n.__('paymentMethodRequired') }).isArray().withMessage('must be array').isIn(['VISA', 'MASTERCARD', 'CASH', 'MADA']).withMessage(() => { return i18n.__('userTypeWrong') }),
            body('productsIncludeTaxes').optional().not().isEmpty().withMessage(() => { return i18n.__('productsIncludeTaxesRequired') }).isBoolean().withMessage('must be boolean'),
            body('institutionStatus').optional().not().isEmpty().withMessage(() => { return i18n.__('institutionStatusRequired') }).isIn(['OPEN', 'BUSY', 'CLOSED']).withMessage(() => { return i18n.__('userTypeWrong') }),

            body('openChat').optional().not().isEmpty().withMessage(() => { return i18n.__('openChatRequired') }).isBoolean().withMessage('must be boolean'),
            body('bank').optional().not().isEmpty().withMessage(() => { return i18n.__('bankRequired') }),
            body('country').optional().not().isEmpty().withMessage(() => { return i18n.__('countryRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, Country, { deleted: false })
                    return true;
                }),
            body('city').optional().not().isEmpty().withMessage(() => { return i18n.__('cityRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, City, { deleted: false })
                    return true;
                }),
            body('region').optional().not().isEmpty().withMessage(() => { return i18n.__('regionRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, Region, { deleted: false })
                    return true;
                }),
        ];

        return validations;
    },
    ////////////////////////////Driver////////////////////////////////////////////
    validateCreateDriver() {
        let validations = [
            body('name').not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
            body('email').optional().trim().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') })
                .isEmail().withMessage(() => { return i18n.__('EmailNotValid') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { email: value, deleted: false, type: 'DRIVER' };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('emailDuplicated'));
                    else
                        return true;
                }),
            body('password').not().isEmpty().withMessage(() => { return i18n.__('passwordRequired') }),
            body('phone').not().isEmpty().withMessage(() => { return i18n.__('PhoneIsRequired') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { phone: value, deleted: false, type: 'DRIVER' };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('phoneIsDuplicated'));
                    else
                        return true;
                }),
            body('countryCode').not().isEmpty().withMessage(() => { return i18n.__('countryCodeRequired') }),
            body('countryKey').not().isEmpty().withMessage(() => { return i18n.__('countryKeyRequired') }),

            body('nationalIdImage').not().isEmpty().withMessage(() => { return i18n.__('nationalIdImageRequired') }),
            body('frontCarLicenceImage').not().isEmpty().withMessage(() => { return i18n.__('frontCarLicenceImageRequired') }),
            body('backCarLicenceImage').not().isEmpty().withMessage(() => { return i18n.__('backCarLicenceImageRequired') }),
            body('frontDriverLicenceImage').not().isEmpty().withMessage(() => { return i18n.__('frontDriverLicenceImageRequired') }),
            body('backDriverLicenceImage').not().isEmpty().withMessage(() => { return i18n.__('backDriverLicenceImageRequired') }),
            body('insideCarImage').not().isEmpty().withMessage(() => { return i18n.__('insideCarImageRequired') }),
            body('internallyCarImage').not().isEmpty().withMessage(() => { return i18n.__('internallyCarImageRequired') }).isArray().withMessage('must be an array'),
            body('frontCarImage').not().isEmpty().withMessage(() => { return i18n.__('frontCarImageRequired') }),
            body('backCarImage').not().isEmpty().withMessage(() => { return i18n.__('backCarImageRequired') }),
            body('frontCarPlateImage').not().isEmpty().withMessage(() => { return i18n.__('frontCarPlateImageRequired') }),
            body('backCarPlateImage').not().isEmpty().withMessage(() => { return i18n.__('backCarPlateImageRequired') }),
            // body('carPlateWithYouImage').not().isEmpty().withMessage(() => { return i18n.__('carPlateWithYouImageRequired') }),
            body('carInsuranceImage').optional().not().isEmpty().withMessage(() => { return i18n.__('carInsuranceImageRequired') }),
            body('carFormImage').not().isEmpty().withMessage(() => { return i18n.__('carFormImageRequired') }),
            body('ibanNumber').not().isEmpty().withMessage(() => { return i18n.__('ibanNumberRequired') }),
            body('coverImage').optional().not().isEmpty().withMessage(() => { return i18n.__('coverImageRequired') }),

            body('country').not().isEmpty().withMessage(() => { return i18n.__('countryRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, Country, { deleted: false })
                    return true;
                }),
            body('city').optional().not().isEmpty().withMessage(() => { return i18n.__('cityRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, City, { deleted: false })
                    return true;
                }),
            body('region').optional().not().isEmpty().withMessage(() => { return i18n.__('regionRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, Region, { deleted: false })
                    return true;
                }),
        ];

        return validations;
    },

    async driverSignUp(req, res, next) {
        try {
            const validatedBody = checkValidations(req);
            if (validatedBody.email)
                validatedBody.email = (validatedBody.email.trim()).toLowerCase();

            if (req.file) {
                let image = await handleImg(req, { attributeName: 'image', isUpdate: false });
                validatedBody.image = image;
            }
            validatedBody.type = 'DRIVER';
            validatedBody.status = 'WAITING';
            let createdUser = await User.create(validatedBody);
            res.status(200).send({ user: createdUser, token: generateToken(createdUser.id) });
            await AdminController.count(validatedBody.type);

        } catch (err) {
            next(err);
        }
    },
    ////////////////////////////Institution////////////////////////////////////////////

    validateAddInstitutionBody() {
        let validations = [
            body('name').not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
            body('email').optional().trim().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') })
                .isEmail().withMessage(() => { return i18n.__('EmailNotValid') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { email: value, deleted: false, type: 'INSTITUTION' };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('emailDuplicated'));
                    else
                        return true;
                }),
            body('password').optional().not().isEmpty().withMessage(() => { return i18n.__('passwordRequired') }),
            body('phone').not().isEmpty().withMessage(() => { return i18n.__('PhoneIsRequired') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { phone: value, deleted: false, type: 'INSTITUTION' };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('phoneIsDuplicated'));
                    else
                        return true;
                }),
            body('countryCode').not().isEmpty().withMessage(() => { return i18n.__('countryCodeRequired') }),
            body('countryKey').not().isEmpty().withMessage(() => { return i18n.__('countryKeyRequired') }),

            body('commercialRegister').optional().not().isEmpty().withMessage(() => { return i18n.__('commercialRegisterRequired') }),
            body('ibanNumber').optional().not().isEmpty().withMessage(() => { return i18n.__('ibanNumberRequired') }),
            body('category').not().isEmpty().withMessage(() => { return i18n.__('categoryRequired') }).custom(async (val, { req }) => {
                await checkExist(val, Category, { deleted: false });
                return true;
            }),
            body('responsibleName').not().isEmpty().withMessage(() => { return i18n.__('responsibleNameRequired') }),
            body('location').not().isEmpty().withMessage(() => { return i18n.__('locationRequired') }),
            body('location.long').not().isEmpty().withMessage(() => { return i18n.__('longitudeRequired') }),
            body('location.lat').not().isEmpty().withMessage(() => { return i18n.__('latitudeRequired') }),

            body('address').not().isEmpty().withMessage(() => { return i18n.__('addressRequired') }),
            body('workingTimeText').optional().not().isEmpty().withMessage(() => { return i18n.__('workingTimeTextRequired') }),
            body('paymentMethod').optional().not().isEmpty().withMessage(() => { return i18n.__('paymentMethodRequired') }).isArray().withMessage('must be array').isIn(['VISA', 'MASTERCARD', 'CASH', 'MADA']).withMessage(() => { return i18n.__('userTypeWrong') }),
            body('productsIncludeTaxes').optional().not().isEmpty().withMessage(() => { return i18n.__('productsIncludeTaxesRequired') }).isBoolean().withMessage('must be boolean'),
            body('institutionStatus').optional().not().isEmpty().withMessage(() => { return i18n.__('institutionStatusRequired') }).isIn(['OPEN', 'BUSY', 'CLOSED']).withMessage(() => { return i18n.__('userTypeWrong') }),
            body('openChat').optional().not().isEmpty().withMessage(() => { return i18n.__('openChatRequired') }).isBoolean().withMessage('must be boolean'),
            body('bank').optional().not().isEmpty().withMessage(() => { return i18n.__('bankRequired') }),
            body('country').optional().not().isEmpty().withMessage(() => { return i18n.__('countryRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, Country, { deleted: false })
                    return true;
                }),
            body('city').optional().not().isEmpty().withMessage(() => { return i18n.__('cityRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, City, { deleted: false })
                    return true;
                }),
            body('region').optional().not().isEmpty().withMessage(() => { return i18n.__('regionRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, Region, { deleted: false })
                    return true;
                }),
        ];
        return validations;
    },

    async institutionSignUp(req, res, next) {
        try {
            const validatedBody = checkValidations(req);
            if (validatedBody.email)
                validatedBody.email = (validatedBody.email.trim()).toLowerCase();

            if (req.file) {
                let image = await handleImg(req, { attributeName: 'image', isUpdate: false });
                validatedBody.image = image;
            }
            validatedBody.type = 'INSTITUTION';
            validatedBody.status = 'WAITING';
            if (!validatedBody.password)
                validatedBody.password = '12345678';
            let createdUser = await User.create(validatedBody);
            res.status(200).send({ user: createdUser });
            await AdminController.count(validatedBody.type);

        } catch (err) {
            next(err);
        }
    },
    async uploadImage(req, res, next) {
        try {
            let productImage = await handleImg(req, { attributeName: 'image', isUpdate: false });
            res.status(200).send({ link: productImage });
        } catch (error) {
            next(error);
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
            await User.updateMany({ _id: { $in: validatedBody.ids }, deleted: false }, { deleted: true, deletedDate: new Date() })
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    },

};