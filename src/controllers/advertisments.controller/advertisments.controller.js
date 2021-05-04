
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

let countNew = async () => {
    try {
        let count = await Advertisments.count({ deleted: false, status: 'WAITING' });
        adminNSP.emit(socketEvents.WaitingAdvCount, { count: count });
    } catch (error) {
        throw error;
    }
} 
const populateQuery = [
    {path:'user',model:'user'}
]
export default {

    async find(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;

            let { status, address, description, phone, whatsappNumber, contactBy, price, lat, long, user } = req.query

            let query = { deleted: false };
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
                    .isIn(['PHONE', 'CONVERSATION']).withMessage(() => { return i18n.__('invalidType') }),
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
                    .isIn(['PHONE', 'CONVERSATION']).withMessage(() => { return i18n.__('invalidType') }),
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
            let advertisment = await Advertisments.create(validatedBody);
            res.status(200).send(advertisment);
            await countNew();
        } catch (error) {
            next(error)
        }
    },

    async update(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            let { AdvertismentsId } = req.params;
            let advertisment = await checkExistThenGet(AdvertismentsId, Advertisments, { deleted: false,populate:populateQuery });

            if (req.files && req.files.length > 0) {
                validatedBody.images = await handleImgs(req, { attributeName: 'images' });
            }
            if (validatedBody.lat && validatedBody.long) {
                validatedBody.geoLocation = { type: 'Point', coordinates: [validatedBody.long, validatedBody.lat] }
            }
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
            advertisment.deleted = true;
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
            let { AdvertismentsId } = req.params;
            let advertisment = await checkExistThenGet(AdvertismentsId, Advertisments, { deleted: false });
            advertisment = await Advertisments.findByIdAndUpdate(AdvertismentsId, validatedBody, { new: true });
            res.status(200).send(advertisment);
            let description  = {en:``,ar:``};

            if (validatedBody.status == 'ACCEPTED') {
                description  = {en:`You advertisment has been accepted in ajam and the commetion for this is ${validatedBody.commetion}`,
                ar:`تم قبول اعلانك في أجَمْ و يجب دفع عمولة بقيمة ${validatedBody.commetion}`};
            } else {
                description  = {en:`Your advertisment has been rejected in Ajam`,ar:`تم رفضا اعلانك في أجَمْ`};
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
    countNew
}

