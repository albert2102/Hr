import Message from "../../models/message.model/message.model";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { createPromise, handleImg } from '../shared.controller/shared.controller'
import User from '../../models/user.model/user.model';
import SocketEvents from '../../socketEvents'
import { body } from "express-validator/check";
import { checkValidations } from '../../controllers/shared.controller/shared.controller';
import i18n from 'i18n'
import ApiError from "../../helpers/ApiError";
import notificationController from '../notif.controller/notif.controller'
import ApiResponse from "../../helpers/ApiResponse";
import Complaint from '../../models/complaint.model/complaint.model';
import Order from '../../models/order.model/order.model';

let popQuery = [
    { path: 'sender', model: 'user' },
    { path: 'reciver.user', model: 'user' },
    { path: 'complaint', model: 'complaint' },
    { path: 'order', model: 'order' }
]

let countUnseen = async (id) => {
    try {
        let query = {
            deleted: false,
            'reciver.user': id,
            'reciver.read': false
        };
        const chatCount = await Message.count(query);
        chatNSP.to('room-' + id).emit(SocketEvents.NewMessageCount, { chatCount: chatCount });
    } catch (error) {
        throw error;
    }
}

let countUnseenForAdmin = async () => {
    try {
        let query = {
            deleted: false,
            'reciver.user': null,
            'reciver.read': false,
            lastMessage: true
        };
        const chatCount = await Message.count(query);
        adminNSP.emit(SocketEvents.NewMessageCount, { count: chatCount });

    } catch (error) {
        throw error;
    }
}

let countUnseenSupportChatForAdmin = async () => {
    try {
        let query = {
            deleted: false,
            'reciver.user': null,
            'reciver.read': false,
            lastMessage: true,
            complaint: null,
            order: null,
            messageType: 'SUPPORT'

        };
        const chatCount = await Message.count(query);
        adminNSP.emit(SocketEvents.SupportChatCount, { count: chatCount });

    } catch (error) {
        throw error;
    }
}
let handelNewMessageSocket = async (message) => {
    try {
        if (message.reciver && message.reciver.user && chatNSP.adapter.rooms['room-' + message.reciver.user.id]) {
            await countUnseen(message.reciver.user.id)
            chatNSP.to('room-' + message.reciver.user.id).emit(SocketEvents.NewMessage, { message: message });
            if (message.reciver.user.activeChatHead == false) {
                let text = {
                    ar: (message.message.text) ? message.message.text : ' رسالة جديدة ',
                    en: (message.message.text) ? message.message.text : 'New Message :'
                };
                await notificationController.pushNotification(message.reciver.user.id, 'MESSAGE', message.sender.id, text)

            }
        } else if (message.reciver && message.reciver.user && !chatNSP.adapter.rooms['room-' + message.reciver.user.id]) {
            await countUnseen(message.reciver.user.id)
            let text = {
                ar: (message.message.text) ? message.message.text : ' رسالة جديدة ',
                en: (message.message.text) ? message.message.text : 'New Message :'
            };
            await notificationController.pushNotification(message.reciver.user.id, 'MESSAGE', message.sender.id, text)
        } else if (!message.reciver.user) {
            chatNSP.to('room-admin').emit(SocketEvents.NewMessage, { message: message });
            await countUnseenForAdmin();
        }
    } catch (error) {
        console.log(error);
    }
}

let updateSeen = async (user) => {
    try {
        await Message.updateMany({ deleted: false, 'reciver.user': user, 'reciver.read': false }, { $set: { 'reciver.read': true, 'reciver.readDate': new Date() } })
        await countUnseen(user);
    } catch (error) {
        throw error;
    }
}



export default {

    validateCreateDefault() {
        let validation = [
            body('text').optional().not().isEmpty().withMessage(() => i18n.__('messageRequired')),
            body('reciver').not().isEmpty().withMessage(() => i18n.__('reciverRequired')),

        ]
        return validation;
    },

    validateComplaint() {
        let validation = [
            body('text').optional().not().isEmpty().withMessage(() => i18n.__('messageRequired')),
            body('complaint').not().isEmpty().withMessage(() => i18n.__('complaintRequired'))
                .custom(async (value, { req }) => {
                    req.complaint = await checkExistThenGet(value, Complaint, { deleted: false });
                }),

        ]
        return validation;
    },

    validateOrder() {
        let validation = [
            body('text').optional().not().isEmpty().withMessage(() => i18n.__('messageRequired')),
            body('order').not().isEmpty().withMessage(() => i18n.__('orderRequired'))
                .custom(async (value, { req }) => {
                    req.order = await checkExistThenGet(value, Order, { deleted: false, driver: { $ne: null } });
                }),

        ]
        return validation;
    },

    async create(req, res, next) {
        try {
            let user = req.user;
            let data = checkValidations(req);
            let complaint = req.complaint;
            let order = req.order;
            let message = { sender: user.id, message: {}, reciver: {} };

            if (complaint) message.complaint = complaint.id;
            if (order) message.order = order.id;

            if (!(data.text || req.file)) {
                return next(new ApiError(404, i18n.__('messageRequired')))
            }

            if (data.text) {
                message.message.text = data.text;
            }
            if (req.file) {
                let file = handleImg(req, { attributeName: 'file' });
                if (req.file.mimetype.includes('image/')) {
                    message.message.image = file;
                } else if (req.file.mimetype.includes('video/')) {
                    message.message.video = file;
                } else if (req.file.mimetype.includes('application/')) {
                    message.message.document = file;
                } else {
                    return next(new ApiError(404, i18n.__('fileTypeError')));
                }
            }

            if ((user.type == 'ADMIN' || user.type == 'SUB_ADMIN') && complaint) {
                message.reciver.user = complaint.user;
            }
            else if ((user.type == 'DRIVER') && order) {
                message.reciver.user = order.user;
            }
            else if ((user.type == 'CLIENT') && order) {
                message.reciver.user = order.driver;
            }
            else if (data.reciver) {
                message.reciver.user = data.reciver;
            }
            //console.log(message)
            message.lastMessage = true;
            let createdMessage = await Message.create(message);
            createdMessage = await Message.populate(createdMessage, popQuery);
            res.status(200).send(createdMessage);

            if (complaint) {
                await Message.updateMany({ deleted: false, _id: { $ne: createdMessage.id }, complaint: complaint.id }, { $set: { lastMessage: false } });

            } else if (order) {
                await Message.updateMany({ deleted: false, _id: { $ne: createdMessage.id }, order: order.id }, { $set: { lastMessage: false } });
            } else if (data.reciver) {
                await Message.updateMany({ deleted: false, _id: { $ne: createdMessage.id }, lastMessage: true, complaint: null, order: null, $or: [{ sender: +user.id, 'reciver.user': data.reciver }, { sender: data.reciver, 'reciver.user': +user.id }] }, { $set: { lastMessage: false } });

            }
            handelNewMessageSocket(createdMessage);


        } catch (error) {
            next(error)
        }
    },
    ///////////////////////////////////////////////////////////// visitor
    validateVisitorComplaint() {
        let validation = [
            body('firebaseToken').not().isEmpty().withMessage(() => i18n.__('firebaseTokenRequired')),
            body('text').optional().not().isEmpty().withMessage(() => i18n.__('messageRequired')),
            body('complaint').not().isEmpty().withMessage(() => i18n.__('complaintRequired'))
                .custom(async (value, { req }) => {
                    req.complaint = await checkExistThenGet(value, Complaint, { deleted: false });
                }),

        ]
        return validation;
    },

    async createVisitorMessage(req, res, next) {
        try {
            let user = req.user;
            let data = checkValidations(req);
            let complaint = req.complaint;

            let message = { message: {}, reciver: {} };

            message.complaint = complaint.id;


            if (!(data.text || req.file)) {
                return next(new ApiError(404, i18n.__('messageRequired')))
            }

            if (data.text) {
                message.message.text = data.text;
            }
            if (req.file) {
                let file = handleImg(req, { attributeName: 'file' });
                if (req.file.mimetype.includes('image/')) {
                    message.message.image = file;
                } else if (req.file.mimetype.includes('video/')) {
                    message.message.video = file;
                } else if (req.file.mimetype.includes('application/')) {
                    message.message.document = file;
                } else {
                    return next(new ApiError(404, i18n.__('fileTypeError')));
                }
            }

            message.lastMessage = true;
            let createdMessage = await Message.create(message);
            createdMessage = await Message.populate(createdMessage, popQuery);
            res.status(200).send(createdMessage);


            await Message.updateMany({ deleted: false, _id: { $ne: createdMessage.id }, complaint: complaint.id }, { $set: { lastMessage: false } });


            handelNewMessageSocket(createdMessage);

        } catch (error) {
            next(error)
        }
    },


    async getVisitorChatHistory(req, res, next) {
        try {

            let { complaint } = req.query;
            let page = +req.query.page || 1,
                limit = +req.query.limit || 20;
            let query = { deleted: false };

            if (complaint) {
                query.order = null;
                query.complaint = complaint;
            }
            else {
                return next(new ApiError(404, i18n.__('targetRequired')));
            }

            let chats = await Message.find(query).populate(popQuery).sort({ _id: -1 }).limit(limit).skip((page - 1) * limit);
            const chatCount = await Message.count(query);
            const pageCount = Math.ceil(chatCount / limit);
            res.send(new ApiResponse(chats, page, pageCount, limit, chatCount, req));
            await Message.updateMany({ deleted: false, firebaseToken: null, 'reciver.read': false, complaint: complaint }, { $set: { 'reciver.read': true, 'reciver.readDate': new Date() } })

        } catch (error) {
            next(error);
        }
    },

    ////////////////////////////////////////////////////////////

    validateCreateSupport() {
        let validation = [
            body('text').optional().not().isEmpty().withMessage(() => i18n.__('messageRequired')),
            body('reciver').optional().not().isEmpty().withMessage(() => i18n.__('reciverRequired')),

        ]
        return validation;
    },

    async createSupport(req, res, next) {
        try {
            let user = req.user;
            let data = checkValidations(req);
            let message = { sender: user.id, message: {}, reciver: {} };
            if (!(data.text || req.file)) {
                return next(new ApiError(404, i18n.__('messageRequired')))
            }

            if ((req.user.type == 'ADMIN') || (req.user.type == 'SUB_ADMIN')) {
                if (!data.reciver) {
                    return next(new ApiError(404, i18n.__('reciverRequired')));
                }
            }

            if (data.reciver) {
                friend = await checkExistThenGet(data.reciver, User, { deleted: false });
                message = { reciver: { user: friend.id }, sender: user.id, message: {} };
            }

            message.messageType = 'SUPPORT'

            if (data.text) {
                message.message.text = data.text;
            }
            if (req.file) {
                let file = handleImg(req, { attributeName: 'file' });
                if (req.file.mimetype.includes('image/')) {
                    message.message.image = file;
                } else if (req.file.mimetype.includes('video/')) {
                    message.message.video = file;
                } else if (req.file.mimetype.includes('application/')) {
                    message.message.document = file;
                } else {
                    return next(new ApiError(404, i18n.__('fileTypeError')));
                }
            }



            let createdMessage = await Message.create(message);
            createdMessage = await Message.populate(createdMessage, popQuery);
            res.status(200).send(createdMessage);
            if ((req.user.type == 'ADMIN') || (req.user.type == 'SUB_ADMIN')) {
                chatNSP.to('room-admin').emit(SocketEvents.NewMessage, { createdMessage });
            } else {
                handelNewMessageSocket(createdMessage);
            }
            await countUnseenSupportChatForAdmin();
        } catch (error) {
            next(error)
        }
    },

    async getSupportChat(req, res, next) {
        try {
            let user = req.user.id;
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            
            
            if ((req.user.type == 'ADMIN') || (req.user.type == 'SUB_ADMIN')) {
                if(!req.query.user){
                    return next(new ApiError(404, i18n.__('userRequired')));
                }
                user = req.query.user;
            }
            let query = { messageType: 'SUPPORT', deleted: false, $or: [{ sender: user }, { 'reciver.user': user }] };
            let messages = await Message.find(query).populate(popQuery).sort({ _id: -1 }).limit(limit).skip((page - 1) * limit);
            let messagesCount = await Message.count(query);
            const pageCount = Math.ceil(messagesCount / limit);
            res.send(new ApiResponse(messages, page, pageCount, limit, messagesCount, req));
            if ((req.user.type == 'ADMIN') || (req.user.type == 'SUB_ADMIN')) {
                await Message.updateMany({ deleted: false, messageType: 'SUPPORT', sender: user, 'reciver.read': false }, { $set: { 'reciver.read': true, 'reciver.readDate': new Date() } })
                await countUnseenSupportChatForAdmin();
            }else{
                await Message.updateMany({ deleted: false, messageType: 'SUPPORT', 'reciver.user': user, 'reciver.read': false }, { $set: { 'reciver.read': true, 'reciver.readDate': new Date() } })
            }
        } catch (error) {
            next(error);
        }
    },
    //////////////////////////////////////////////////////

    async getById(req, res, next) {
        try {
            let { id } = req.params;
            let message = await checkExistThenGet(id, Message, { deleted: false });
            res.status(200).send(message);
        } catch (error) {
            next(error)
        }
    },

    async deleteForEveryOne(req, res, next) {
        try {
            let { id } = req.params;
            let message = await checkExistThenGet(id, Message, { deleted: false });
            message.deleted = true;
            await message.save();
            res.status(200).send('Deleted');
        } catch (error) {
            next(error)
        }
    },

    async getChatHistory(req, res, next) {
        try {
            let user = req.user ? req.user.id : null;
            let { friend, complaint, order } = req.query;
            console.log(req.query)
            let page = +req.query.page || 1,
                limit = +req.query.limit || 20;
            let query = { deleted: false };

            if (friend) {
                query.complaint = null;
                query.order = null;
                query.$or = [{ sender: user, 'reciver.user': friend }, { sender: friend, 'reciver.user': user }];
            } else if (complaint) {
                query.order = null;
                query.complaint = complaint;

            } else if (order) {
                query.complaint = null;
                query.order = order;
            }
            else {
                return next(new ApiError(404, i18n.__('targetRequired')));
            }

            let chats = await Message.find(query).populate(popQuery).sort({ _id: -1 }).limit(limit).skip((page - 1) * limit);
            const chatCount = await Message.count(query);
            const pageCount = Math.ceil(chatCount / limit);
            res.send(new ApiResponse(chats, page, pageCount, limit, chatCount, req));

            if (friend) {
                await Message.updateMany({ deleted: false, sender: friend, 'reciver.user': user, 'reciver.read': false }, { $set: { 'reciver.read': true, 'reciver.readDate': new Date() } });
            } else if (complaint) {
                complaint = await Complaint.findOne({ _id: complaint });
                await Message.updateMany({ deleted: false, 'reciver.user': user, 'reciver.read': false, complaint: complaint.id }, { $set: { 'reciver.read': true, 'reciver.readDate': new Date() } })
            } else if (order) {
                order = await Order.findOne({ _id: order });
                await Message.updateMany({ deleted: false, 'reciver.user': user, 'reciver.read': false, order: order.id }, { $set: { 'reciver.read': true, 'reciver.readDate': new Date() } })
            }

        } catch (error) {
            next(error);
        }
    },

    async getLastContacts(req, res, next) {
        try {
            let user = req.user.id;
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let query = {
                deleted: false,
                messageType: { $ne: 'SUPPORT' },
                $or: [
                    { lastMessage: true, complaint: null, order: null, $or: [{ sender: +user }, { 'reciver.user': +user }] },
                    { lastMessage: true, complaint: { $ne: null }, order: null, $or: [{ sender: +user }, { 'reciver.user': +user }] },
                    { lastMessage: true, order: { $ne: null }, complaint: null, $or: [{ sender: +user }, { 'reciver.user': +user }] }
                ]
            };

            let messages = await Message.find(query).populate(popQuery).sort({ _id: -1 }).limit(limit).skip((page - 1) * limit);
            let resolveData = [];
            let data = [];
            let length = messages.length;
            for (let index = 0; index < length; index++) {
                let countQuery = { deleted: false, 'reciver.read': false, 'reciver.user': +user };
                if (!messages[index].order && !messages[index].complaint) countQuery.sender = messages[index].sender.id;
                if (messages[index].order) countQuery.order = messages[index].order;
                if (messages[index].complaint) countQuery.complaint = messages[index].complaint;

                resolveData.push(createPromise(Message.count(countQuery)));
            }
            let resolveResult = await Promise.all(resolveData);
            for (let index = 0; index < length; index++) {
                data.push({ message: messages[index], unReadCount: resolveResult[index] });
            }
            messages = data;
            let messagesCount = await Message.count(query);
            const pageCount = Math.ceil(messagesCount / limit);
            res.send(new ApiResponse(messages, page, pageCount, limit, messagesCount, req));
        } catch (error) {
            next(error);
        }
    },

    //////////////////////////////////Admin Requests/////////////////////////////////////////

    async getLastComplaintsChatsForAdmin(req, res, next) {
        try {
            let page = +req.query.page || 1,
                limit = +req.query.limit || 20;
            if (req.user.type != 'ADMIN' && req.user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('unauthorized')));
            }
            let { complaint, complaintNumber } = req.query;

            let query = {
                deleted: false,
                lastMessage: true,
                complaint: { $ne: null }
            };
            if (complaint) query.complaint = complaint;
            if (complaintNumber) {
                let complaints = await Complaint.find({ deleted: false, number: { '$regex': complaintNumber, '$options': 'i' } }).distinct('_id');
                query.complaint = { $in: complaints };
            }
            var chats = await Message.find(query).populate(popQuery).sort({ _id: -1 }).limit(limit).skip((page - 1) * limit)
            const chatCount = await Message.count(query);
            const pageCount = Math.ceil(chatCount / limit);
            res.send(new ApiResponse(chats, page, pageCount, limit, chatCount, req));
            await countUnseenForAdmin();
        } catch (error) {
            next(error)
        }
    },

    async getLastChatsForAdmin(req, res, next) {
        try {
            let page = +req.query.page || 1,
                limit = +req.query.limit || 20;
            if (req.user.type != 'ADMIN' && req.user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('unauthorized')));
            }

            let query = {
                deleted: false,
                lastMessage: true,
                complaint: null,
                order: null,
                messageType: { $ne: 'SUPPORT' }
            };

            var chats = await Message.find(query).populate(popQuery).sort({ _id: -1 }).limit(limit).skip((page - 1) * limit)
            const chatCount = await Message.count(query);
            const pageCount = Math.ceil(chatCount / limit);
            res.send(new ApiResponse(chats, page, pageCount, limit, chatCount, req));
            await countUnseenForAdmin();
        } catch (error) {
            next(error)
        }
    },

    async getLastOrdersChatsForAdmin(req, res, next) {
        try {
            let page = +req.query.page || 1,
                limit = +req.query.limit || 20;
            if (req.user.type != 'ADMIN' && req.user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('unauthorized')));
            }

            let query = {
                deleted: false,
                lastMessage: true,
                complaint: null,
                order: { $ne: null }

            };

            var chats = await Message.find(query).populate(popQuery).sort({ _id: -1 }).limit(limit).skip((page - 1) * limit)
            const chatCount = await Message.count(query);
            const pageCount = Math.ceil(chatCount / limit);
            res.send(new ApiResponse(chats, page, pageCount, limit, chatCount, req));
            await countUnseenForAdmin();
        } catch (error) {
            next(error)
        }
    },

    async getSpecificChat(req, res, next) {
        try {

            if (req.user.type != 'ADMIN' && req.user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('unauthorized')));
            }
            let { user, friend, complaint, order } = req.query;
            if (user && !friend) return next(new ApiError(403, ('friend is required')));
            if (!user && friend) return next(new ApiError(403, ('friend is required')));

            let page = +req.query.page || 1,
                limit = +req.query.limit || 20;
            let query = { deleted: false };

            if (friend && user) {
                query.complaint = null;
                query.order = null;
                query.$or = [{ sender: user, 'reciver.user': friend }, { sender: friend, 'reciver.user': user }];
            } else if (complaint) {
                query.order = null;
                query.complaint = complaint;

            } else if (order) {
                query.complaint = null;
                query.order = order;
            }
            else {
                return next(new ApiError(404, i18n.__('targetRequired')));
            }
            console.log(query.$or)
            let chats = await Message.find(query).populate(popQuery).sort({ _id: -1 }).limit(limit).skip((page - 1) * limit);
            const chatCount = await Message.count(query);
            const pageCount = Math.ceil(chatCount / limit);
            res.send(new ApiResponse(chats, page, pageCount, limit, chatCount, req));

        } catch (error) {
            next(error);
        }
    },

    async getLastSupportChatsForAdmin(req, res, next) {
        try {
            let page = +req.query.page || 1,
                limit = +req.query.limit || 20;
            if (req.user.type != 'ADMIN' && req.user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('unauthorized')));
            }

            let query = {
                deleted: false,
                lastMessage: true,
                complaint: null,
                order: null,
                messageType: 'SUPPORT'
            };

            var chats = await Message.find(query).populate(popQuery).sort({ _id: -1 }).limit(limit).skip((page - 1) * limit)
            const chatCount = await Message.count(query);
            const pageCount = Math.ceil(chatCount / limit);
            res.send(new ApiResponse(chats, page, pageCount, limit, chatCount, req));
            await countUnseenSupportChatForAdmin();
        } catch (error) {
            next(error)
        }
    },

    countUnseen,
    updateSeen,
    countUnseenForAdmin,
    countUnseenSupportChatForAdmin
}