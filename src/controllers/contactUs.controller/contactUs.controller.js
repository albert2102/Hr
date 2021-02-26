
import Contactus from '../../models/contactUs.model/contactUs.model';
import ApiResponse from "../../helpers/ApiResponse";
import { checkExistThenGet } from "../../helpers/CheckMethods";
import { body } from 'express-validator/check';
import { checkValidations } from "../shared.controller/shared.controller";
import i18n from 'i18n';
import notifyController from '../notif.controller/notif.controller';
import socketEvents from '../../socketEvents'
import { sendEmail } from '../../services/emailMessage.service'
import config from '../../config'
const populateQuery = [
    { path: 'user', model: 'user' }
];


let countNotReplied = async () => {
    try {
        let count = await Contactus.count({ deleted: false, "reply.0": { "$exists": false } });
        adminNSP.emit(socketEvents.ContactUsCount, { count: count });
    } catch (error) {
        throw error;
    }
}

export default {

    async find(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;

            let { name, notes, phone, user, firebaseTokenType } = req.query

            let query = { deleted: false };
            if (name) {
                query.name = { '$regex': name, '$options': 'i' }
            }
            if (notes) {
                query.notes = { '$regex': notes, '$options': 'i' }
            }
            if (phone) {
                query.phone = { '$regex': phone, '$options': 'i' }
            }
            if (user) {
                query.user = user
            }
            if (firebaseTokenType) {
                query.firebaseTokenType = firebaseTokenType
            }

            let contactuss = await Contactus.find(query)
                .sort({ createdAt: -1 }).populate(populateQuery)
                .limit(limit)
                .skip((page - 1) * limit);

            const contactussCount = await Contactus.count(query);
            const pageCount = Math.ceil(contactussCount / limit);
            res.status(200).send(new ApiResponse(contactuss, page, pageCount, limit, contactussCount, req));

        } catch (err) {
            next(err);
        }
    },

    validateBody() {
        let validations = [
            body('name').optional().not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
            body('email').optional().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') }),
            body('notes').not().isEmpty().withMessage(() => { return i18n.__('notesRequired') }),
            body('phone').not().isEmpty().withMessage(() => { return i18n.__('phoneRequired') })

        ];

        return validations;
    },

    async create(req, res, next) {
        try {
            const validatedBody = checkValidations(req);
            if (req.user)
                validatedBody.user = req.user.id;
            let contactUs = await Contactus.create(validatedBody);
            contactUs = await Contactus.populate(contactUs, populateQuery);
            res.status(200).send(contactUs);
            await countNotReplied()
        } catch (error) {
            next(error)
        }
    },

    async findById(req, res, next) {
        try {
            let { contactUsId } = req.params;
            let contactUs = await checkExistThenGet(contactUsId, Contactus, { deleted: false, populate: populateQuery });
            res.status(200).send(contactUs);
        }
        catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let { contactUsId } = req.params;
            let contactUs = await checkExistThenGet(contactUsId, Contactus, { deleted: false });
            contactUs.deleted = true;
            await contactUs.save();
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    },

    validateReply() {
        let validations = [
            body('reply').not().isEmpty().withMessage('replyRequired')
        ];
        return validations;
    },

    async reply(req, res, next) {
        try {
            const validatedBody = checkValidations(req);
            let { contactUsId } = req.params;
            let contactUs = await checkExistThenGet(contactUsId, Contactus, { deleted: false, populate: populateQuery });
            let newContactUs = await Contactus.findOneAndUpdate({ deleted: false, _id: contactUsId }, { $push: { reply: validatedBody.reply } }, { new: true })
            res.status(200).send({ newContactUs });
            await notifyController.create(req.user.id, newContactUs.user, { en: validatedBody.reply, ar: validatedBody.reply }, newContactUs.id, 'CONTACTUS');
            if (req.user.language == 'ar'){
                await notifyController.pushNotification(newContactUs.user, 'CONTACTUS', newContactUs.id, validatedBody.reply,config.notificationTitle.ar );

            }else{
            await notifyController.pushNotification(newContactUs.user, 'CONTACTUS', newContactUs.id, validatedBody.reply,config.notificationTitle.ar );

            }
            await sendEmail(contactUs.email, validatedBody.reply);
            await countNotReplied();
        }
        catch (err) {
            next(err);
        }
    },

    countNotReplied
}

