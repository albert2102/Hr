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
import config from '../../config';
import Country from '../../models/country.model/country.model';
import schedule from "node-schedule";
const populateQuery = [
    { path: 'resource', model: 'user' },
    { path: 'target', model: 'user' },
    { path: 'users', model: 'user' },
    { path: 'order', model: 'order' },
    { path: 'promoCode', model: 'promocode' },

];

let create = async (resource, target, description, subject, subjectType, order,orderStatus) => {
    try {
        var query = { resource, target, description, subject, subjectType }
        if (subjectType == "PROMOCODE") query.promoCode = subject;
        if (subjectType == "ORDER") query.order = subject;
        if (subjectType == "CHANGE_ORDER_STATUS") query.order = subject;
        
        if (orderStatus) query.orderStatus = orderStatus;

        if (subject && subjectType) {
            query.subjectType = subjectType;
            query.subject = subject;
        }
        if (order) {
            query.order = order;
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

    async pushNotification(targetUser, subjectType, subjectId, text,targetUserData) {
        try {
            var user = targetUserData ? targetUserData : await checkExistThenGet(targetUser, User, { deleted: false });
            if (user.notification) {
                let notifTitle = config.notificationTitle;
                let data = { targetUser: user, subjectType: subjectType, subjectId: subjectId, text: text[user.language], title: notifTitle[user.language] }
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
            body('titleOfNotification.ar').not().isEmpty().withMessage(()=>i18n.__('arabicTitleRequired')),
            body('titleOfNotification.en').not().isEmpty().withMessage(()=>i18n.__('englishTitleRequired')),
            body('text.ar').not().isEmpty().withMessage(()=>i18n.__('arabicTextRequired')),
            body('text.en').not().isEmpty().withMessage(()=>i18n.__('englishTextRequired')),
            body('userType').optional().not().isEmpty().withMessage(()=>i18n.__('userTypeRequired'))
            .isIn(['CLIENT', 'INSTITUTION', 'DRIVER']).withMessage(()=>i18n.__('invalidUserType')),
            body('country').optional().not().isEmpty().withMessage(() => { return i18n.__('countryRequired') })
                .custom(async (value, { req }) => {
                    await checkExistThenGet(value, Country, { deleted: false })
                    return true;
                }),
        ];
        return validations;
    },

    async adminSendToAllUsers(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('admin.auth')));
            }
            // const url = req.protocol + '://' + req.get('host'); //+ '/';
            const url = config.backend_endpoint + '/';
            let validatedBody = checkValidations(req);
            if (req.file) {
                let image = await handleImg(req, { attributeName: 'image', isUpdate: false });
                validatedBody.image = image;
            }
            let notifiObj = {titleOfNotification :validatedBody.titleOfNotification, resource: req.user.id, type: "ALL", subjectType: "ADMIN", description: validatedBody.text };
            let userQuery = { deleted: false, type: {$nin : ['ADMIN','SUB_ADMIN']} };
            
            if(validatedBody.image) notifiObj.image = validatedBody.image;
            if(validatedBody.userType) {
                notifiObj.userType = validatedBody.userType; 
                userQuery.type =  validatedBody.userType;
            }
            if(validatedBody.country) userQuery.country = validatedBody.country;
            await Notif.create(notifiObj)

            var allUsers = await User.find(userQuery);
            allUsers.forEach(async (user) => {
                if (user.notification) {
                    sendPushNotification(
                        {
                            targetUser: user,
                            subjectType: "ADMIN",
                            subjectId: 1,
                            text: validatedBody.text[user.language],
                            title: validatedBody.titleOfNotification[user.language],
                            image: (validatedBody.image) ? url + validatedBody.image : ''
                        });
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
            body('titleOfNotification.ar').not().isEmpty().withMessage(()=>i18n.__('arabicTitleRequired')),
            body('titleOfNotification.en').not().isEmpty().withMessage(()=>i18n.__('englishTitleRequired')),

            body('text.ar').not().isEmpty().withMessage(()=>i18n.__('arabicTextRequired')),
            body('text.en').not().isEmpty().withMessage(()=>i18n.__('englishTextRequired')),

            body('users').not().isEmpty().withMessage(()=>i18n.__('userRequired'))
            .isArray().withMessage(()=>i18n.__('muntBeArray'))
                .custom(async (val, { req }) => {
                    for (let index = 0; index < val.length; index++) {
                        await checkExist(val[index], User, { deleted: false });
                    }
                    return true;
                })
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
            // const url = req.protocol + '://' + req.get('host'); //+ '/';
            const url = config.backend_endpoint + '/';

            let notifiObj = {titleOfNotification :validatedBody.titleOfNotification, resource: req.user.id, type: "USERS", subjectType: "ADMIN", description: validatedBody.text, users: validatedBody.users };
            if(validatedBody.image) notifiObj.image = validatedBody.image
            await Notif.create(notifiObj)
            var allUsers = await User.find({ deleted: false, _id: { $in: validatedBody.users } });
            allUsers.forEach(async (user) => {
                if (user.notification) {
                    sendPushNotification(
                        {
                            targetUser: user,
                            subjectType: "ADMIN",
                            subjectId: 1,
                            text: validatedBody.text[user.language],
                            title: validatedBody.titleOfNotification[user.language],
                            image: (validatedBody.image) ? url + validatedBody.image : ''
                        });
                }
                notificationNSP.to('room-'+user.id).emit(socketEvents.NotificationsCount, { count:await Notif.count({$or:[{target: user.id},{users:user.id}],informed: { $ne: user.id },deleted: false,usersDeleted: { $ne: user.id }}) });

            });
            const job = schedule.scheduleJob('* * 21 10 *', function(){
                console.log('====================================');
                console.log('heeeeeeer');
                console.log('====================================');
                allUsers.forEach(async (user) => {
                    if (user.notification) {
                        sendPushNotification(
                            {
                                targetUser: user,
                                subjectType: "ADMIN",
                                subjectId: 1,
                                text: validatedBody.text[user.language],
                                title: validatedBody.titleOfNotification[user.language],
                                image: (validatedBody.image) ? url + validatedBody.image : ''
                            });
                    }});
              });
              job.cancel();
            res.status(200).send("Successfully send to user");

        } catch (error) {
            next(error)

        }
    },
    create,
    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let { resource, admin ,removeLanguage,userType} = req.query;
            let query = { deleted: false, subjectType: "ADMIN", type: { $ne: null } };
            if (resource) query.resource = resource;
	    if (userType) query.userType = userType;
            var notifs = await Notif.find(query).populate(populateQuery)
                .sort({ _id: -1 })
                .limit(limit)
                .skip((page - 1) * limit);
            if (!removeLanguage)
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
    },

    //////////////////////////////////////////////////////////////
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
            await Notif.updateMany({ _id: { $in: validatedBody.ids }, deleted: false }, { deleted: true, deletedDate: new Date() })
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    },
}