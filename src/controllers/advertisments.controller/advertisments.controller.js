
import Advertisments from '../../models/advertisments.model/advertisments.model';
import ApiResponse from "../../helpers/ApiResponse";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { body } from 'express-validator/check';
import { checkValidations, handleImg, handleImgs } from "../shared.controller/shared.controller";
import i18n from 'i18n';
import ApiError from '../../helpers/ApiError';
import socketEvents from '../../socketEvents';
import notifyController from '../notif.controller/notif.controller';
import config from "../../config";
import moment from 'moment';
import schedule from 'node-schedule'

let countNew = async () => {
    try {
        let count = await Advertisments.count({ deleted: false, status: {$in:['WAITING','UPDATED']} });
        adminNSP.emit(socketEvents.WaitingAdvCount, { count: count });
    } catch (error) {
        throw error;
    }
} 
const populateQuery = [
    {path:'user',model:'user'}
]

const advertismentJob = async () => {
    
    var j = schedule.scheduleJob('*/1 * * * *', async function (fireDate) {
        var date = new Date();
        let advertisments = await Advertisments.find({deleted:false , endedDate : {$lte:date},status:{$nin:['REJECTED','DELETED','ENDED','UPDATED']} });
        let desc={
            ar : 'لقد انتهى عرض اعلانك في التطبيق ,يمكنك إعادة نشره مرة أخري',
            en :"Your advertisment has expired in the app, you can re-post it again."
        };
        for (let index = 0; index < advertisments.length; index++) {
            await notifyController.create(advertisments[index].user, advertisments[index].user,desc, 1, 'ADVERTISMENT');
            notifyController.pushNotification(advertisments[index].user, 'ADVERTISMENT', advertisments[index].id, desc, config.notificationTitle);
            notificationNSP.to('room-' + advertisments[index].user).emit(socketEvents.ChangeAdvertismentStatus, { advertisment: advertisments[index] });
        }
        await Advertisments.updateMany({_id:{$in:advertisments}} , {status:'ENDED'} );
    })
}
export default {

    async find(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;

            let { status, address, description, phone, whatsappNumber, contactBy, price, lat, long, user,archive} = req.query

            let query = { deleted: false,status:{$ne:'DELETED'} };
            if (archive) query.deleted = true;
            if (user) query.user = +user;
            if (status) query.status = status;
            if (address) query.address = { '$regex': address, '$options': 'i' };
            if (description) query.description = { '$regex': description, '$options': 'i' };
            if (phone) query.phone = { '$regex': phone, '$options': 'i' };
            if (whatsappNumber) query.whatsappNumber = { '$regex': whatsappNumber, '$options': 'i' };
            if (contactBy) query.contactBy = contactBy;
            if (price) query.price = +price;

            let aggregateQuery = [
                { $match: query },
                { $sort:{ createdAt: -1 }},
                { $limit: limit },
                { $skip: (page - 1) * limit }];

            if (lat && long) {
                aggregateQuery.unshift({ $geoNear: { near: { type: "Point", coordinates: [+long, +lat] }, distanceField: "dist.calculated" } })
            }
            console.log(aggregateQuery)
            let advertisment = await Advertisments.aggregate(aggregateQuery)
            advertisment = await Advertisments.populate(advertisment,populateQuery)
            const advertismentCount = await Advertisments.count(query);
            const pageCount = Math.ceil(advertismentCount / limit);
            res.status(200).send(new ApiResponse(advertisment, page, pageCount, limit, advertismentCount, req));
        } catch (err) {
            next(err);
        }
    },

    validateBody(isUpdate = false) {
        let validations;
        if (!isUpdate) {
            validations = [
                body('address').not().isEmpty().withMessage(() => { return i18n.__('addressRequired') }),
                body('description').not().isEmpty().withMessage(() => { return i18n.__('descriptionRequired') }),
                body('phone').not().isEmpty().withMessage(() => { return i18n.__('phoneRequired') }),
                body('whatsappNumber').optional().not().isEmpty().withMessage(() => { return i18n.__('whatsappNumberRequired') }),
                body('contactBy').not().isEmpty().withMessage(() => { return i18n.__('contactByRequired') })
                .isArray().withMessage('must be array').isIn(['PHONE', 'CONVERSATION']).withMessage(() => { return i18n.__('invalidType') }),
                body('long').not().isEmpty().withMessage(() => { return i18n.__('longRequired') }),
                body('lat').not().isEmpty().withMessage(() => { return i18n.__('latRequired') }),
                body('price').not().isEmpty().withMessage(() => { return i18n.__('priceRequired') }),

            ];
        } else {
            validations = [
                body('address').optional().not().isEmpty().withMessage(() => { return i18n.__('addressRequired') }),
                body('description').optional().not().isEmpty().withMessage(() => { return i18n.__('descriptionRequired') }),
                body('phone').optional().not().isEmpty().withMessage(() => { return i18n.__('phoneRequired') }),
                body('whatsappNumber').optional().not().isEmpty().withMessage(() => { return i18n.__('whatsappNumberRequired') }),
                body('contactBy').optional().not().isEmpty().withMessage(() => { return i18n.__('contactByRequired') })
                .isArray().withMessage('must be array').isIn(['PHONE', 'CONVERSATION']).withMessage(() => { return i18n.__('invalidType') }),
                body('long').optional().not().isEmpty().withMessage(() => { return i18n.__('longRequired') }),
                body('lat').optional().not().isEmpty().withMessage(() => { return i18n.__('latRequired') }),
                body('price').optional().not().isEmpty().withMessage(() => { return i18n.__('priceRequired') }),
            ]
        }

        return validations;
    },

    async create(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            validatedBody.user = req.user.id;
            if (req.files && req.files.length > 0) {
                validatedBody.images = await handleImgs(req, { attributeName: 'images' });
            } else {
                return next(new ApiError(401, i18n.__('imagesRequired')))
            }
            if (validatedBody.lat && validatedBody.long) {
                validatedBody.geoLocation = { type: 'Point', coordinates: [validatedBody.long, validatedBody.lat] }
            }
            let currDate = moment();
            let endedDate = moment(currDate).add(1,'M');
            validatedBody.endedDate = endedDate;
            let advertisment = await Advertisments.create(validatedBody);
            res.status(200).send(advertisment);
            await countNew();
        } catch (error) {
            next(error)
        }
    },

    async update(req, res, next) {
        try {
            let user = req.user;
            let validatedBody = checkValidations(req);
            let { AdvertismentsId } = req.params;
            let advertisment = await checkExistThenGet(AdvertismentsId, Advertisments, { deleted: false,populate:populateQuery });
            if (req.files && req.files.length > 0) {
                validatedBody.images = await handleImgs(req, { attributeName: 'images' });
            }
            if (validatedBody.lat && validatedBody.long) {
                validatedBody.geoLocation = { type: 'Point', coordinates: [validatedBody.long, validatedBody.lat] }
            }
            if(user.type == 'CLIENT') validatedBody.status = 'UPDATED';
            advertisment = await Advertisments.findByIdAndUpdate(AdvertismentsId, validatedBody, { new: true });
            res.status(200).send(advertisment);
        } catch (error) {
            next(error)
        }
    },

    async findById(req, res, next) {
        try {
            let { AdvertismentsId } = req.params;
            let advertisment = await checkExistThenGet(AdvertismentsId, Advertisments, { deleted: false,populate:populateQuery});
            res.status(200).send(advertisment);
        }
        catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let user = req.user
            let { AdvertismentsId } = req.params;
            let advertisment = await checkExistThenGet(AdvertismentsId, Advertisments, { deleted: false });
            if(user.type == 'ADMIN' && user.type == 'SUB_ADMIN'){
                advertisment.deleted = true;
            }else{
                advertisment.status = 'DELETED';
            }
            await advertisment.save();
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    },

    validateAdminChangeStatus() {
        return [
            body('commetion').optional().not().isEmpty().withMessage(() => { return i18n.__('commetionRequired') }),
            body('rejectedReason').optional().not().isEmpty().withMessage(() => { return i18n.__('rejectedReasonRequired') }),
            body('status').not().isEmpty().withMessage(() => { return i18n.__('statusRequired') })
                .isIn(['ACCEPTED', 'REJECTED']).withMessage(() => { return i18n.__('invalidType') }),
        ]
    },

    async changeStatus(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(401, 'غير مسموح'))
            }
            let validatedBody = checkValidations(req);
            if ((validatedBody.status =='ACCEPTED')&& (!validatedBody.commetion)) {
                return next(new ApiError(404,i18n.__('commetionRequired')));
            }
            if ((validatedBody.status =='REJECTED')&& (!validatedBody.rejectedReason)) {
                return next(new ApiError(404,i18n.__('rejectedReasonRequired')));
            }
            let { AdvertismentsId } = req.params;
            let advertisment = await checkExistThenGet(AdvertismentsId, Advertisments, { deleted: false });
            advertisment = await Advertisments.findByIdAndUpdate(AdvertismentsId, validatedBody, { new: true });
            res.status(200).send(advertisment);
            let description  = {en:``,ar:``};

            if (validatedBody.status == 'ACCEPTED') {
                description  = {en:`You advertisment has been accepted in ajam and the commetion for this is ${validatedBody.commetion}`,
                ar:` تم قبول اعلانك في أجَمْ و يجب دفع عمولة بقيمة ${validatedBody.commetion}`};
            } else {
                description  = {en:`Your advertisment has been rejected in Ajam as ${validatedBody.rejectedReason}`,ar:` تم رفضا اعلانك في أجَمْ بسبب ${validatedBody.rejectedReason}`};
            }


            await notifyController.create(req.user.id, advertisment.user, description, advertisment.id, 'ADVERTISMENT', null, advertisment.id);
            notificationNSP.to('room-' + advertisment.user).emit(socketEvents.ChangeAdvertismentStatus, { advertisment: advertisment });
            notifyController.pushNotification(advertisment.user, 'ADVERTISMENT', advertisment.id, description, config.notificationTitle);

            await countNew();

        } catch (error) {
            next(error)
        }
    },

    async updateNumberOfViews(req, res, next) {
        try {
            let { AdvertismentsId } = req.params;
            let advertisment = await checkExistThenGet(AdvertismentsId, Advertisments, { deleted: false });
            advertisment.numberOfViews = advertisment.numberOfViews + 1;
            await advertisment.save();
            res.status(200).send(advertisment);

        } catch (error) {
            next(error)
        }
    },
    countNew,

    validateRepublish(){
        return[
            body('advertisment').not().isEmpty().withMessage(() => { return i18n.__('productRequired') })
                .custom(async (val, { req }) => {
                    req.advertisment = await checkExistThenGet(val, Advertisments, { deleted: false,status:'ENDED' });
                    return true;
                }),
        ]
    },

    async republish(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            let user = req.user;
            let advertisment = req.advertisment;
            validatedBody.advertisment = advertisment._id;
            validatedBody.images = advertisment.images;
            validatedBody.address = advertisment.address;
            validatedBody.contactBy = advertisment.contactBy;
            validatedBody.geoLocation = advertisment.geoLocation;
            validatedBody.price = advertisment.price;
            validatedBody.description = advertisment.description;
            validatedBody.phone = advertisment.phone;
            validatedBody.user = advertisment.user;
            if(advertisment.whatsappNumber) validatedBody.whatsappNumber = advertisment.whatsappNumber;
            let currDate = moment();
            let endedDate = moment(currDate).add(1,'M');
            validatedBody.endedDate = endedDate;
            
            if(user.id != advertisment.user){
                return next(new ApiError(401, 'غير مسموح'));
            }
            advertisment = await Advertisments.create(validatedBody);
            res.status(200).send(advertisment);
        }
        catch (err) {
            next(err);
        }
    },

    advertismentJob
}

