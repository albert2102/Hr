import Message from "../../models/message.model/message.model";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { handleImg } from '../shared.controller/shared.controller'
import User from '../../models/user.model/user.model';
import SocketEvents from '../../socketEvents'
import { body } from "express-validator/check";
import { checkValidations } from '../../controllers/shared.controller/shared.controller';
import i18n from 'i18n'
import ApiError from "../../helpers/ApiError";
import notificationController from '../notif.controller/notif.controller'
import ApiResponse from "../../helpers/ApiResponse";
import Complaint from '../../models/complaint.model/complaint.model';

let popQuery = [{ path: 'sender', model: 'user' }, { path: 'reciver.user', model: 'user' }, { path: 'complaint', model: 'complaint' }]
 
let countUnseen = async (id)=>{
    try {
        let query = {
            deleted: false,
            'reciver.user': id ,
            'reciver.read': false 
        };
        const chatCount = await Message.count(query);
        chatNSP.to('room-' + id).emit(SocketEvents.NewMessageCount, { chatCount: chatCount });
    } catch (error) {
        throw error ;
    }
}

let countUnseenForAdmin = async ()=>{
    try {
        let query = {
            deleted: false,
            'reciver.user': null,
            'reciver.read': false,
            lastMessage: true
        };
        const chatCount = await Message.count(query);
        chatNSP.to('room-admin').emit(SocketEvents.NewMessageCount, {count:chatCount });
    } catch (error) {
        throw error ;
    }
}
let handelNewMessageSocket = async (message) => {
    try {
        if (message.reciver && message.reciver.user && chatNSP.adapter.rooms['room-' + message.reciver.user.id]) {
            await countUnseen(message.reciver.user.id)
            chatNSP.to('room-' + message.reciver.user.id).emit(SocketEvents.NewMessage, { message: message });
            if (message.reciver.user.activeChatHead == false) {
                let text = (message.message.text) ? message.message.text : ' رسالة جديدة ';
                if (message.reciver.user.language == 'ar') {
                    await notificationController.pushNotification(message.reciver.user.id, 'MESSAGE', message.sender.id, text)
                } else {
                    await notificationController.pushNotification(message.reciver.user.id, 'MESSAGE', message.sender.id, text)
                }
            }
        } else if(message.reciver && message.reciver.user && !chatNSP.adapter.rooms['room-' + message.reciver.user.id]) {
            await countUnseen(message.reciver.user.id)
            let text = (message.message.text) ? message.message.text :' رسالة جديدة ';
            if (message.reciver.user.language == 'ar') {
                await notificationController.pushNotification(message.reciver.user.id, 'MESSAGE', message.sender.id, text)
            } else {
                await notificationController.pushNotification(message.reciver.user.id, 'MESSAGE', message.sender.id, text)
            }
        }else if(!message.reciver.user){
            chatNSP.to('room-admin').emit(SocketEvents.NewMessage, { message: message });
            await countUnseenForAdmin();
        }
    } catch (error) {
        console.log(error);
    }
}

let updateSeen = async (user)=>{
    try {
        await Message.updateMany({ deleted: false, 'reciver.user': user,'reciver.read':false }, { $set: { 'reciver.read': true, 'reciver.readDate': new Date() } })
        await countUnseen(user);
    } catch (error) {
        throw error ;
    }
}



export default {
    validate() {
        let validation = [
            body('text').optional().not().isEmpty().withMessage(() => i18n.__('messageRequired')),
            body('reciver').optional().not().isEmpty().withMessage(() => i18n.__('reciverRequired')),
            body('complaint').not().isEmpty().withMessage(() => i18n.__('complaintRequired'))
            .custom(async (value,{req}) => {
                req.complaint = await checkExistThenGet(value, Complaint, { deleted: false });
            }),

        ]
        return validation;
    },

    async create(req, res, next) {
        try {
            let user = req.user;
            
            let data = checkValidations(req);
            let complaint = req.complaint;
            
            let message = { sender: user.id, message: {},complaint:complaint.id,reciver:{} };

            
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

            if (user.type != 'CLIENT' ) {
                message.reciver.user = complaint.user;
            }else{
                delete message.reciver ;
            }
            console.log(message)
            message.lastMessage = true;
            let createdMessage = await Message.create(message);
            createdMessage = await Message.populate(createdMessage, popQuery);
            res.status(200).send(createdMessage);
            if (user.type == 'CLIENT' ) {
                await Message.updateMany({deleted:false , _id:{$ne:createdMessage.id} ,complaint: complaint.id,$or:[{sender:user.id},{'reciver.user':user.id}]},{$set:{lastMessage:false}});
                
            }else{
                await Message.updateMany({deleted:false , _id:{$ne:createdMessage.id} ,complaint: complaint.id,$or:[{sender:data.reciver},{'reciver.user':data.reciver}]},{$set:{lastMessage:false}});
            }
            handelNewMessageSocket(createdMessage);

        } catch (error) {
            next(error)
        }
    },
    
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

    async getChatForUser(req, res, next) {
        try {
            let page = +req.query.page || 1,
                limit = +req.query.limit || 20;
            
            let {complaint } = req.query;
            if(!complaint) return next(new ApiError(403, 'complaint in query is required'));
            let user = (await checkExistThenGet(complaint,Complaint,{deleted: false})).user;
            let query = {
                deleted: false,
                $or: [{ sender: user },
                    { 'reciver.user': user }
                    ],
                complaint: complaint
            };
            let updatedMessageQuery = { deleted: false, sender: user,'reciver.read':false,complaint:complaint }
            await Message.updateMany(updatedMessageQuery, { $set: { 'reciver.read': true, 'reciver.readDate': new Date() } })
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
            if(req.user.type != 'ADMIN'  && req.user.type != 'SUB_ADMIN' && req.user.type != 'COMPANY'){
                return next(new ApiError(403, ('unauthorized')));
            }
            let {complaint,complaintNumber } = req.query;

            let query = {
                deleted: false,
                lastMessage: true
            };
            if(complaint) query.complaint = complaint;
            if(complaintNumber) {
                let complaints = await Complaint.find({deleted: false,number:{ '$regex': complaintNumber, '$options': 'i' }}).distinct('_id');
                query.complaint = {$in: complaints};
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
    countUnseen,
    updateSeen,
    countUnseenForAdmin
}