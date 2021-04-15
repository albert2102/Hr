import User from "../../models/user.model/user.model";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import Notif from "../../models/notif.model/notif.model";
import ApiResponse from "../../helpers/ApiResponse";
import { sendPushNotification } from '../../services/push-notification-service'
import { checkValidations, handleImg } from '../shared.controller/shared.controller';
import { body } from 'express-validator/check';
import ApiError from "../../helpers/ApiError";
import i18n from 'i18n';
import socketEvents from '../../socketEvents';
import config from '../../config'
const populateQuery = [
    { path: 'resource', model: 'user' },
    { path: 'target', model: 'user' },
    { path: 'users', model: 'user' },
    { path: 'order', model: 'order' },
    { path: 'promoCode', model: 'promocode' },

];

let create = async (resource, target, description, subject, subjectType, order,addvertisment) => {
    try {
        var query = { resource, target, description, subject, subjectType }
        if (subjectType == "PROMOCODE") query.promoCode = subject;
        if (subjectType == "ORDER") query.order = subject;
        if (subjectType == "CHANGE_ORDER_STATUS") query.order = subject;

        if (subject && subjectType) {
            query.subjectType = subjectType;
            query.subject = subject;
        }
        if (order) {
            query.order = order;
        }
        if (addvertisment) {
            query.addvertisment = addvertisment;
        }

        var newNotification = new Notif(query);
        await newNotification.save();

        let counter = await Notif.count({ deleted: false, target: target, informed: { $ne: target } });
        notificationNSP.to('room-' + target).emit(socketEvents.NotificationsCount, { count: counter });
    } catch (error) {
        console.log(error.message)
    }
}

export default {

    async findMyNotification(req, res, next) {
        try {
            let user = req.user._id;
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let query = {
                deleted: false,
                $or: [{ target: user }, { users: { $elemMatch: { $eq: user } } }, { type: 'ALL' }],
                type: { $nin: ['MAIL', 'SMS'] },
                createdAt: { $gte: req.user.createdAt },
                usersDeleted: { $ne: user }
            };
            let { subjectType } = req.query
            if (subjectType) query = { subjectType: 'ADMIN', deleted: false, usersDeleted: { $ne: user } };

            var notifs = await Notif.find(query).populate(populateQuery)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip((page - 1) * limit);

            notifs = Notif.schema.methods.toJSONLocalizedOnly(notifs, i18n.getLocale());
            const notifsCount = await Notif.count(query);
            const pageCount = Math.ceil(notifsCount / limit);
            if (!subjectType) {
                query = { $or: [{ target: user }, { users: user, type: 'USERS' }], informed: { $ne: user }, deleted: false, usersDeleted: { $ne: user } }

                await Notif.updateMany(query, { $addToSet: { informed: user } });
                var toRoom = 'room-' + user;
                notificationNSP.to(toRoom).emit(socketEvents.NotificationsCount, { count: 0 });
            }

            res.send(new ApiResponse(notifs, page, pageCount, limit, notifsCount, req));
        } catch (err) {
            next(err);
        }
    },

    async read(req, res, next) {
        try {
            let { notifId } = req.params;
            let notif = await checkExistThenGet(notifId, Notif);
            notif.read = true;
            await notif.save();
            res.send('notif read');
        } catch (error) {
            next(error);
        }
    },

    async unread(req, res, next) {
        try {
            let { notifId } = req.params;
            let notif = await checkExistThenGet(notifId, Notif);
            notif.read = false;
            await notif.save();
            res.send('notif unread');
        } catch (error) {
            next(error);
        }
    },

    async getCountNotification(id, admin = false) {
        try {
            var toRoom = 'room-' + id;
            var query = {
                $or:[{target: id},{users:id}],
                informed: { $ne: id },
                deleted: false,
                usersDeleted: { $ne: id }
            }
            var notifsCount = await Notif.count(query);
            if (!admin) {
                notificationNSP.to(toRoom).emit(socketEvents.NotificationsCount, { count: notifsCount });
            }
            else {
                adminNSP.to('room-admin').emit(socketEvents.NotificationsCount, { count: notifsCount });
            }
        } catch (err) {
            console.log(err.message);
        }
    },
    // NewNotification


    async pushNotification(targetUser, subjectType, subjectId, text, title) {
        try {
            var user = await checkExistThenGet(targetUser, User, { deleted: false });
            if (user.notification) {
                let data = { targetUser: user, subjectType: subjectType, subjectId: subjectId, text: text, title: title }

                sendPushNotification(data);
            } else {
                return true;
            }
        } catch (error) {
            console.log(error.message)
        }
    },

    validateAdminSendToAll() {
        let validations = [
            body('titleOfNotification.ar').not().isEmpty().withMessage('titleOfNotification is required'),
            body('titleOfNotification.en').not().isEmpty().withMessage('titleOfNotification is required'),
            body('text.ar').not().isEmpty().withMessage('text is required'),
            body('text.en').not().isEmpty().withMessage('text is required'),

        ];
        return validations;
    },

    async adminSendToAllUsers(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('admin.auth')));
            }
            let validatedBody = checkValidations(req);
            if (req.file) {
                let image = await handleImg(req, { attributeName: 'image', isUpdate: false });
                validatedBody.image = image;
            }
            let notifiObj = { resource: req.user.id, type: "ALL", subjectType: "ADMIN", description: validatedBody.text };
            if(validatedBody.image) notifiObj.image = validatedBody.image
            await Notif.create(notifiObj)
            var allUsers = await User.find({ deleted: false, type: 'CLIENT' });
            allUsers.forEach(async (user) => {
                if (user.notification) {
                    if (user.language == 'ar') {
                        sendPushNotification(
                            {
                                targetUser: user,
                                subjectType: "ADMIN",
                                subjectId: 1,
                                text: validatedBody.text.ar,
                                title: validatedBody.titleOfNotification.ar,
                                image: (validatedBody.image) ? config.backend_endpoint + validatedBody.image : ''
                            });
                    }
                    else {
                        sendPushNotification(
                            {
                                targetUser: user,
                                subjectType: "ADMIN",
                                subjectId: 1,
                                text: validatedBody.text.en,
                                title: validatedBody.titleOfNotification.en,
                                image: (validatedBody.image) ? config.backend_endpoint + validatedBody.image : ''
                            });
                    }
                }
                notificationNSP.to('room-'+user.id).emit(socketEvents.NotificationsCount, { count:await Notif.count({$or:[{target: user.id},{users:user.id}],informed: { $ne: user.id },deleted: false,usersDeleted: { $ne: user.id }}) });

            });
            res.status(200).send("Successfully send to all users");
        } catch (error) {
            next(error)
        }
    },

    validateAdminSendToSpecificUsers() {
        let validations = [
            body('titleOfNotification.ar').not().isEmpty().withMessage('titleOfNotification is required'),
            body('titleOfNotification.en').not().isEmpty().withMessage('titleOfNotification is required'),
            body('text.ar').not().isEmpty().withMessage('text is required'),
            body('text.en').not().isEmpty().withMessage('text is required'),
            body('users').not().isEmpty().withMessage('users is required').isArray().withMessage('must be array').custom(async (val, { req }) => {
                for (let index = 0; index < val.length; index++) {
                    await checkExist(val[index], User, { deleted: false });
                }
                return true;
            }),
        ];
        return validations;
    },
    async adminSendToAllSpecificUsers(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            if (req.file) {
                let image = await handleImg(req, { attributeName: 'image', isUpdate: false });
                validatedBody.image = image;
            }
            let notifiObj = { resource: req.user.id, type: "USERS", subjectType: "ADMIN", description: validatedBody.text, users: validatedBody.users };
            if(validatedBody.image) notifiObj.image = validatedBody.image
            await Notif.create(notifiObj)
            var allUsers = await User.find({ deleted: false, _id: { $in: validatedBody.users } });
            allUsers.forEach(async (user) => {
                if (user.notification) {
                    if (user.language == 'ar') {
                        sendPushNotification(
                            {
                                targetUser: user,
                                subjectType: "ADMIN",
                                subjectId: 1,
                                text: validatedBody.text.ar,
                                title: validatedBody.titleOfNotification.ar,
                                image: (validatedBody.image) ? config.backend_endpoint + validatedBody.image : ''
                            });
                    }
                    else {
                        sendPushNotification(
                            {
                                targetUser: user,
                                subjectType: "ADMIN",
                                subjectId: 1,
                                text: validatedBody.text.en,
                                title: validatedBody.titleOfNotification.en,
                                image: (validatedBody.image) ? config.backend_endpoint + validatedBody.image : ''
                            });
                    }
                }
                notificationNSP.to('room-'+user.id).emit(socketEvents.NotificationsCount, { count:await Notif.count({$or:[{target: user.id},{users:user.id}],informed: { $ne: user.id },deleted: false,usersDeleted: { $ne: user.id }}) });

            });
            res.status(200).send("Successfully send to user");

        } catch (error) {
            next(error)

        }
    },
    create,
    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let { resource, admin } = req.query;
            let query = { deleted: false, subjectType: "ADMIN", type: { $ne: null } };
            if (resource) query.resource = resource;
            var notifs = await Notif.find(query).populate(populateQuery)
                .sort({ _id: -1 })
                .limit(limit)
                .skip((page - 1) * limit);
            if (!admin)
                notifs = Notif.schema.methods.toJSONLocalizedOnly(notifs, i18n.getLocale());
            const notifsCount = await Notif.count(query);
            const pageCount = Math.ceil(notifsCount / limit);
            res.send(new ApiResponse(notifs, page, pageCount, limit, notifsCount, req));
        } catch (err) {
            next(err);
        }
    },


    async delete(req, res, next) {
        try {
            let { notifId } = req.params;
            let notif = await checkExistThenGet(notifId, Notif, { deleted: false });
            notif.deleted = true;
            await notif.save();
            res.send('notif deleted');
        } catch (error) {
            next(error);
        }
    },
    async userDelete(req, res, next) {
        try {
            let { notifId } = req.params;
            let notif = await checkExistThenGet(notifId, Notif, { deleted: false });
            await Notif.findByIdAndUpdate(notifId, { $push: { usersDeleted: req.user.id } });
            res.send('notif deleted');
        } catch (error) {
            next(error);
        }
    },
    async findById(req, res, next) {
        try {
            let { notifId } = req.params;
            let { removeLanguage } = req.query;
            let notifi = await checkExistThenGet(notifId, Notif, { deleted: false, populate: populateQuery });
            if (!removeLanguage) {
                notifi = Notif.schema.methods.toJSONLocalizedOnly(notifi, i18n.getLocale());
            }
            res.status(200).send(notifi)

        } catch (err) {
            next(err)
        }
    }
}