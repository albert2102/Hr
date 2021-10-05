import bcrypt from 'bcryptjs';
import { body } from "express-validator/check";
import { checkValidations, handleImg, fieldhandleImg } from '../shared.controller/shared.controller';
import { generateToken } from '../../utils/token';
import User from '../../models/user.model/user.model';
import { checkExistThenGet, checkExist } from '../../helpers/CheckMethods';
import ApiError from '../../helpers/ApiError';
import i18n from 'i18n'
import socketEvents from '../../socketEvents';
import ConfirmationCode from '../../models/confirmationsCodes.model/confirmationscodes.model'
import notificationController from '../notif.controller/notif.controller';
import Category from '../../models/category.model/category.model';
import Country from "../../models/country.model/country.model";
import City from "../../models/city.model/city.model";
import Region from "../../models/region.model/region.model";
import config from '../../config';
import { sendHtmlEmail } from '../../services/emailMessage.service';

let populateQuery = [
    { path: 'rules', model: 'assignRule' },
    { path: 'category', model: 'category' },
    { path: 'country', model: 'country' },
    { path: 'city', model: 'city', populate: { path: 'country', model: 'country' } },
    { path: 'region', model: 'region', populate: [{ path: 'city', model: 'city', populate: { path: 'country', model: 'country' } }] }

];

let count = async (type) => {
    try {
        let count = await User.count({ deleted: false, status: 'WAITING', type: type });
        if (type == 'DRIVER') {
            adminNSP.emit(socketEvents.WaitingDriverCount, { count: count });

        } else {
            adminNSP.emit(socketEvents.WaitingInstitutionCount, { count: count });
        }
    } catch (error) {
        throw error;
    }
}
export default {


    validateAdminSignUp(isUpdate = false) {
        let validations;
        if (!isUpdate) {
            validations = [
                body('name').not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
                body('email').trim().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') })
                    .isEmail().withMessage(() => { return i18n.__('EmailNotValid') })
                    .custom(async (value, { req }) => {
                        value = (value.trim()).toLowerCase();
                        let userQuery = { email: value, deleted: false };
                        if (await User.findOne(userQuery))
                            throw new Error(i18n.__('emailDuplicated'));
                        else
                            return true;
                    }),
                body('password').not().isEmpty().withMessage(() => { return i18n.__('passwordRequired') }),
                body('type').not().isEmpty().withMessage(() => { return i18n.__('typeIsRequired') }).isIn(['ADMIN', 'SUB_ADMIN']).withMessage(() => { return i18n.__('userTypeWrong') }),
                body('phone').not().isEmpty().withMessage(() => { return i18n.__('PhoneIsRequired') })
                    .custom(async (value, { req }) => {
                        value = (value.trim()).toLowerCase();
                        let userQuery = { phone: value, deleted: false };
                        if (await User.findOne(userQuery))
                            throw new Error(i18n.__('phoneIsDuplicated'));
                        else
                            return true;
                    }),
                body('language').optional().not().isEmpty().withMessage(() => { return i18n.__('languageRequired') }),
                body('countryCode').not().isEmpty().withMessage(() => { return i18n.__('countryCodeRequired') }),
                body('countryKey').not().isEmpty().withMessage(() => { return i18n.__('countryKeyRequired') }),

            ];
        } else {
            validations = [
                body('name').optional().not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
                body('email').optional().trim().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') })
                    .isEmail().withMessage(() => { return i18n.__('EmailNotValid') })
                    .custom(async (value, { req }) => {
                        value = (value.trim()).toLowerCase();
                        let userQuery = { email: value, deleted: false, _id: { $ne: req.user._id } };
                        if (await User.findOne(userQuery))
                            throw new Error(i18n.__('emailDuplicated'));
                        else
                            return true;
                    }),
                body('password').optional().not().isEmpty().withMessage(() => { return i18n.__('passwordRequired') }),
                body('phone').optional().not().isEmpty().withMessage(() => { return i18n.__('PhoneIsRequired') })
                    .custom(async (value, { req }) => {
                        value = (value.trim()).toLowerCase();
                        let userQuery = { phone: value, deleted: false, _id: { $ne: req.user._id } };

                        if (await User.findOne(userQuery))
                            throw new Error(i18n.__('phoneIsDuplicated'));
                        else
                            return true;
                    }),
                body('language').optional().not().isEmpty().withMessage(() => { return i18n.__('languageRequired') }),
                body('newPassword').optional().not().isEmpty().withMessage(() => { return i18n.__('newPasswordRequired') }),
                body('currentPassword').optional().not().isEmpty().withMessage(() => { return i18n.__('CurrentPasswordRequired') }),
                body('countryCode').optional().not().isEmpty().withMessage(() => { return i18n.__('countryCodeRequired') }),
                body('countryKey').optional().not().isEmpty().withMessage(() => { return i18n.__('countryKeyRequired') }),

            ];
        }
        return validations;
    },

    async signUp(req, res, next) {
        try {
            const validatedBody = checkValidations(req);
            validatedBody.email = (validatedBody.email.trim()).toLowerCase();
            if (req.file) {
                let image = await handleImg(req, { attributeName: 'image', isUpdate: false });
                validatedBody.image = image;
            }
            let createdUser = await User.create(validatedBody);
            res.status(200).send({ user: createdUser, token: generateToken(createdUser.id) })
        } catch (err) {
            next(err);
        }
    },

    async updateProfile(req, res, next) {
        try {
            let user = req.user;
            const validatedBody = checkValidations(req);
            if (req.file) {
                let image = await handleImg(req, { attributeName: 'image', isUpdate: false });
                validatedBody.image = image;
            }
            if (validatedBody.password) {
                const salt = bcrypt.genSaltSync();
                validatedBody.password = await bcrypt.hash(validatedBody.password, salt);
            }
            if (validatedBody.newPassword) {

                if (validatedBody.currentPassword) {
                    if (bcrypt.compareSync(validatedBody.currentPassword, user.password)) {
                        const salt = bcrypt.genSaltSync();
                        var hash = await bcrypt.hash(validatedBody.newPassword, salt);
                        validatedBody.password = hash;
                        delete validatedBody.newPassword;
                        delete validatedBody.currentPassword;
                        user = await User.findOneAndUpdate({ deleted: false, _id: user.id }, validatedBody, { new: true })
                        user = await User.schema.methods.toJSONLocalizedOnly(user, i18n.getLocale());
                        res.status(200).send(user);
                    } else {
                        return next(new ApiError(403, i18n.__('currentPasswordInvalid')))
                    }
                } else {
                    return res.status(400).send({
                        error: [{
                            location: 'body',
                            param: 'currentPassword', msg: i18n.__('CurrentPasswordRequired')
                        }]
                    });
                }
            } else {
                user = await User.findOneAndUpdate({ deleted: false, _id: user.id }, validatedBody, { new: true })
                res.status(200).send(user);
            }
        } catch (err) {
            next(err);
        }
    },

    validateAdminSignin() {
        let validations = [
            body('email').not().isEmpty().withMessage(() => { return i18n.__('emailRequired') }),
            body('password').not().isEmpty().withMessage(() => { return i18n.__('passwordRequired') }),
            body('type').not().isEmpty().withMessage(() => { return i18n.__('typeIsRequired') })
                .isIn(['ADMIN', 'SUB_ADMIN']).withMessage(() => { return i18n.__('userTypeWrong') }),
        ];
        return validations;
    },
    async adminSignIn(req, res, next) {
        try {
            const validatedBody = checkValidations(req);
            var query = { deleted: false, type: validatedBody.type };
            query.email = validatedBody.email.toLowerCase();
            let user = await User.findOne(query)
            if (user) {
                await user.isValidPassword(validatedBody.password, async function (err, isMatch) {
                    if (err) {
                        next(err)
                    }
                    if (isMatch) {
                        if (!user.activated) {
                            return next(new ApiError(403, i18n.__('accountStop')));
                        }
                        res.status(200).send({ user, token: generateToken(user.id) });
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

    validateAddUserBody() {
        let validations = [
            body('name').not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
            body('email').optional().trim().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') })
                .isEmail().withMessage(() => { return i18n.__('EmailNotValid') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { email: value, deleted: false, type: 'CLIENT' };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('emailDuplicated'));
                    else
                        return true;
                }),
            body('password').not().isEmpty().withMessage(() => { return i18n.__('passwordRequired') }),
            body('phone').not().isEmpty().withMessage(() => { return i18n.__('PhoneIsRequired') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { phone: value, deleted: false, type: 'CLIENT' };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('phoneIsDuplicated'));
                    else
                        return true;
                }),
            body('type').not().isEmpty().withMessage(() => { return i18n.__('typeIsRequired') })
                .isIn(['ADMIN', 'SUB_ADMIN', 'CLIENT']).withMessage(() => { return i18n.__('userTypeWrong') }),
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

    validateAdminChangeUser() {
        let validations = [
            body('userId').not().isEmpty().withMessage(() => { return i18n.__('userIdRequired') }),
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

    async addUser(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(401, 'غير مسموح'))
            }
            const validatedBody = checkValidations(req);
            if (validatedBody.email) {
                validatedBody.email = (validatedBody.email.trim()).toLowerCase();

            }

            if (req.file) {
                let image = handleImg(req, { attributeName: 'image', isUpdate: false });
                validatedBody.image = image;
            }
            let createdUser = await User.create(validatedBody);
            createdUser = await User.schema.methods.toJSONLocalizedOnly(createdUser, i18n.getLocale());
            res.status(200).send({ user: createdUser });
        } catch (error) {
            next(error)
        }
    },

    async userInformation(req, res, next) {
        try {
            var userId = req.query.userId;
            if (!userId) userId = req.user.id;
            var user = await checkExistThenGet(userId, User, { deleted: false, populate: populateQuery });
            user = await User.schema.methods.toJSONLocalizedOnly(user, i18n.getLocale());
            res.status(200).send({ user: user });
        } catch (error) {
            next(error);
        }
    },

    async adminUpdateUser(req, res, next) {
        try {
            if (req.user.type != 'ADMIN' && req.user.type != 'SUB_ADMIN') {
                return next(new ApiError(401, 'غير مسموح'))
            }
            let validatedBody = checkValidations(req);
            if (validatedBody.email) validatedBody.email = (validatedBody.email.trim()).toLowerCase();
            let user = await checkExistThenGet(validatedBody.userId, User, { deleted: false });
            if (validatedBody.password) {
                const salt = bcrypt.genSaltSync();
                validatedBody.password = await bcrypt.hash(validatedBody.password, salt);
            }
            if (req.file) {
                let image = handleImg(req, { attributeName: 'image', isUpdate: false });
                validatedBody.image = image;
            }
            if (validatedBody.location && validatedBody.location.lat && validatedBody.location.lat) {
                validatedBody.geoLocation = { type: 'Point', coordinates: [validatedBody.location.long, validatedBody.location.lat] }
            }
            user = await User.findOneAndUpdate({ deleted: false, _id: validatedBody.userId }, validatedBody, { new: true }).populate(populateQuery)
            user = await User.schema.methods.toJSONLocalizedOnly(user, i18n.getLocale());
            res.status(200).send(user);
            if (user.type == 'INSTITUTION') {
                notificationNSP.emit(socketEvents.UpdatedTrader, { user: user });
            }
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
            user.deleted = true;
            await user.save();
            notificationNSP.to('room-' + userId).emit(socketEvents.LogOut, { user })
            res.status(200).send('Deleted Successfully');
        } catch (error) {
            next(error);
        }
    },

    validateAdminActivateUser() {
        let validations = [
            body('activated').not().isEmpty().withMessage(() => { return i18n.__('activatedRequired') }).isBoolean().withMessage(() => { return i18n.__('activatedValueError') }),
            body('userId').not().isEmpty().withMessage(() => { return i18n.__('userIdRequired') })
        ];
        return validations;
    },

    async adminActivateUser(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            let authUser = req.user;

            if (authUser.type != 'ADMIN' && authUser.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('admin.auth')));
            }
            await checkExist(validatedBody.userId, User, { deleted: false });
            var newUser = await User.findByIdAndUpdate(validatedBody.userId, { activated: validatedBody.activated }, { new: true });
            if (newUser.activated == false) {
                notificationNSP.to('room-' + validatedBody.userId).emit(socketEvents.LogOut, { newUser })
            }
            if (newUser.activated == false && newUser.type == 'SUB_ADMIN') {
                adminNSP.to('room-' + validatedBody.userId).emit(socketEvents.LogOut, { newUser })
            }
            res.status(200).send(newUser);
        } catch (error) {
            next(error);
        }
    },

    validateDeleteFromArchive() {
        let validations = [
            body('ids').not().isEmpty().withMessage(() => { return i18n.__('idsRequired') }).isArray()
                .withMessage(() => { return i18n.__('mustBeArray') })
        ];
        return validations;
    },

    async deleteFromArchive(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('admin.auth')));
            }
            let ids = checkValidations(req).ids;
            await User.deleteMany({ _id: { $in: ids } })
            res.status(200).send('Deleted Successfully from archive');
        } catch (error) {
            next(error);
        }
    },

    validateAddDriverBody() {
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

            body('ajamTaxes').not().isEmpty().withMessage(() => { return i18n.__('taxesRequired') }).isInt({ min: 0, max: 100 }),
            
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

    validateAdminChangeDriver() {
        let validations = [
            body('userId').not().isEmpty().withMessage(() => { return i18n.__('userIdRequired') }),
            body('name').optional().not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
            body('email').optional().trim().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') })
                .isEmail().withMessage(() => { return i18n.__('EmailNotValid') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { email: value, deleted: false, _id: { $ne: req.body.userId }, type: 'DRIVER' };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('emailDuplicated'));
                    else
                        return true;
                }),
            body('password').optional().not().isEmpty().withMessage(() => { return i18n.__('passwordRequired') }),
            body('phone').optional().not().isEmpty().withMessage(() => { return i18n.__('PhoneIsRequired') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { phone: value, deleted: false, _id: { $ne: req.body.userId }, type: 'DRIVER' };

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

            body('ajamTaxes').optional().not().isEmpty().withMessage(() => { return i18n.__('taxesRequired') }).isInt({ min: 0, max: 100 }),
            
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
    async addDriver(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(401, 'غير مسموح'))
            }
            let validatedBody = checkValidations(req);
            validatedBody.type = 'DRIVER';

            if (validatedBody.email) {
                validatedBody.email = (validatedBody.email.trim()).toLowerCase();
            }

            if (req.file) {
                let image = handleImg(req, { attributeName: 'image', isUpdate: false });
                validatedBody.image = image;
            }
            let createdUser = await User.create(validatedBody);
            createdUser = await User.schema.methods.toJSONLocalizedOnly(createdUser, i18n.getLocale());
            res.status(200).send({ user: createdUser });
        } catch (error) {
            next(error)
        }
    },

    validateAddInstitutionBody() {
        let validations = [
            body('name').not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
            body('email').trim().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') })
                .isEmail().withMessage(() => { return i18n.__('EmailNotValid') })
                .custom(async (value, { req }) => {
                    value = (value.trim()).toLowerCase();
                    let userQuery = { email: value, deleted: false, type: 'INSTITUTION' };
                    if (await User.findOne(userQuery))
                        throw new Error(i18n.__('emailDuplicated'));
                    else
                        return true;
                }),
            body('password').not().isEmpty().withMessage(() => { return i18n.__('passwordRequired') }),
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
            body('ibanNumber').not().isEmpty().withMessage(() => { return i18n.__('ibanNumberRequired') }),
            body('category').not().isEmpty().withMessage(() => { return i18n.__('categoryRequired') }).custom(async (val, { req }) => {
                await checkExist(val, Category, { deleted: false });
                return true;
            }),
            body('responsibleName').not().isEmpty().withMessage(() => { return i18n.__('responsibleNameRequired') }),
            body('location').not().isEmpty().withMessage(() => { return i18n.__('locationRequired') }),
            body('location.long').not().isEmpty().withMessage(() => { return i18n.__('longitudeRequired') }),
            body('location.lat').not().isEmpty().withMessage(() => { return i18n.__('latitudeRequired') }),
            body('ajamTaxes').not().isEmpty().withMessage(() => { return i18n.__('taxesRequired') }).isInt({ min: 0, max: 100 }),

            body('address').not().isEmpty().withMessage(() => { return i18n.__('addressRequired') }),
            body('workingTimeText').not().isEmpty().withMessage(() => { return i18n.__('workingTimeTextRequired') }),
            body('paymentMethod').not().isEmpty().withMessage(() => { return i18n.__('paymentMethodRequired') }).isArray().withMessage('must be array').isIn(['VISA', 'MASTERCARD', 'CASH', 'MADA']).withMessage(() => { return i18n.__('userTypeWrong') }),
            body('productsIncludeTaxes').optional().not().isEmpty().withMessage(() => { return i18n.__('productsIncludeTaxesRequired') }).isBoolean().withMessage('must be boolean'),
            body('institutionStatus').optional().not().isEmpty().withMessage(() => { return i18n.__('institutionStatusRequired') }).isIn(['OPEN', 'BUSY', 'CLOSED']).withMessage(() => { return i18n.__('userTypeWrong') }),
            body('openChat').optional().not().isEmpty().withMessage(() => { return i18n.__('openChatRequired') }).isBoolean().withMessage('must be boolean'),

            body('deliveryPricePerSecond').not().isEmpty().withMessage(() => { return i18n.__('deliveryPricePerSecondRequired') }),
            body('minDeliveryPrice').not().isEmpty().withMessage(() => { return i18n.__('minDeliveryPriceRequired') }),

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

    validateAdminChangeInstitution() {
        let validations = [
            body('userId').not().isEmpty().withMessage(() => { return i18n.__('userIdRequired') }),
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
            body('ajamTaxes').optional().not().isEmpty().withMessage(() => { return i18n.__('taxesRequired') }).isInt({ min: 0, max: 100 }),

            body('address').optional().not().isEmpty().withMessage(() => { return i18n.__('addressRequired') }),
            body('workingTimeText').optional().not().isEmpty().withMessage(() => { return i18n.__('workingTimeTextRequired') }),
            body('paymentMethod').optional().not().isEmpty().withMessage(() => { return i18n.__('paymentMethodRequired') }).isArray().withMessage('must be array').isIn(['VISA', 'MASTERCARD', 'CASH', 'MADA']).withMessage(() => { return i18n.__('userTypeWrong') }),
            body('productsIncludeTaxes').optional().not().isEmpty().withMessage(() => { return i18n.__('productsIncludeTaxesRequired') }).isBoolean().withMessage('must be boolean'),
            body('institutionStatus').optional().not().isEmpty().withMessage(() => { return i18n.__('institutionStatusRequired') }).isIn(['OPEN', 'BUSY', 'CLOSED']).withMessage(() => { return i18n.__('userTypeWrong') }),
            body('openChat').optional().not().isEmpty().withMessage(() => { return i18n.__('openChatRequired') }),
            body('deliveryPricePerSecond').optional().not().isEmpty().withMessage(() => { return i18n.__('deliveryPricePerSecondRequired') }),
            body('minDeliveryPrice').optional().not().isEmpty().withMessage(() => { return i18n.__('minDeliveryPriceRequired') }),

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
                body('status').optional().not().isEmpty().withMessage(() => { return i18n.__('statusRequired') }).isIn(['ACCEPTED', 'WAITING']),
            
        ];

        return validations;
    },

    async addInstitution(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(401, 'غير مسموح'))
            }
            let validatedBody = checkValidations(req);
            validatedBody.type = 'INSTITUTION';
            validatedBody.geoLocation = { type: 'Point', coordinates: [validatedBody.location.long, validatedBody.location.lat] }

            if (validatedBody.email) {
                validatedBody.email = (validatedBody.email.trim()).toLowerCase();
            }

            if (req.file) {
                let image = handleImg(req, { attributeName: 'image', isUpdate: false });
                validatedBody.image = image;
            }

            let createdUser = await User.create(validatedBody);
            createdUser = await User.schema.methods.toJSONLocalizedOnly(createdUser, i18n.getLocale());
            res.status(200).send({ user: createdUser });
        } catch (error) {
            next(error)
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

    count,

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    validateChangeStatus() {
        let validation = [
            body('status').not().isEmpty().withMessage(() => { return i18n.__('statusRequired') }).isIn(['ACCEPTED', 'REJECTED']),
            body('userId').not().isEmpty().withMessage(() => { return i18n.__('userIdRequired') })
        ];
        return validation;
    },

    async changeStatus(req, res, next) {
        try {
            let user = req.user;
            if ((user.type != 'ADMIN') && (user.type != 'SUB_ADMIN')) {
                return next(new ApiError(403, i18n.__('unauth')));
            }
            let validatedBody = checkValidations(req);
            let verifyUser = await checkExistThenGet(validatedBody.userId, User, { deleted: false, status: 'WAITING', type: { $in: ['INSTITUTION', 'DRIVER'] } });
            validatedBody.updatedStatusDate = new Date();
            verifyUser = await User.findByIdAndUpdate(validatedBody.userId, validatedBody, { new: true });
            res.status(200).send(verifyUser)
            await count(verifyUser.type);

            let description;

            if (verifyUser.type == 'DRIVER') {
                if (validatedBody.status == 'ACCEPTED') {
                    // description = { en: "You are now a captain in the Agam team", ar: "انت الآن  كابتن لدي فريق أجَمْ" }
                    await sendHtmlEmail(verifyUser.email,'trader-confirmation.html',{FName:verifyUser.name,lName:''});

                } else {
                    // description = { en: "You request to join Ajam has been rejected", ar: "تم رفض طلبك لمشاركة أجَمْ ككابتن" }
                    await sendHtmlEmail(verifyUser.email,'trader-rejected.html',{FName:verifyUser.name,lName:''});

                }

            } else {
                if (validatedBody.status == 'ACCEPTED') {
                    // description = { en: "You are now an instituation in the Ajam team", ar: "انت الآن  متجر لدي فريق أجَمْ" }
                     await sendHtmlEmail(verifyUser.email,'trader-confirmation.html',{FName:verifyUser.name,lName:''});
                } else {
                    // description = { en: "You request to join Ajam has been rejected", ar: "تم رفض طلبك لمشاركة أجَمْ كمتجر" }
                    await sendHtmlEmail(verifyUser.email,'trader-rejected.html',{FName:verifyUser.name,lName:''});

                }
            }
            // await notificationController.create(req.user.id, validatedBody.userId, description, validatedBody.userId, 'JOIN_STATUS');
            // notificationController.pushNotification(validatedBody.userId, 'JOIN_STATUS', validatedBody.userId, description);



        } catch (error) {
            next(error);
        }
    },
    /////////////////////////////reports//////////////////////////////////////////////
    async reportsByCategory(req, res, next) {
        try {
            let { fromDate, toDate, category } = req.query;
            let query = { deleted: false, type: 'INSTITUTION' };

            if (fromDate && !toDate) query.createdAt = { $gte: new Date(moment(fromDate).startOf('day')) };
            if (toDate && !fromDate) query.createdAt = { $lt: new Date(moment(toDate).endOf('day')) };
            if (fromDate && toDate) query.createdAt = { $gte: new Date(moment(fromDate).startOf('day')), $lt: new Date(moment(toDate).endOf('day')) };

            if (category) query.category = +category;

            let results = await User.aggregate()
                .match(query)
                .group({
                    _id: '$category',
                    count: { $sum: 1 },
                    traders: { $push: '$$ROOT' },
                })
            results = await User.populate(results, { path: '_id', model: 'category' })
            res.send({ data: results });
        } catch (err) {
            next(err);
        }
    },
};