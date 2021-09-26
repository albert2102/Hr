import Complaint from '../../models/complaint.model/complaint.model';
import { body } from 'express-validator/check';
import { checkValidations, handleImg } from '../shared.controller/shared.controller';
import { checkExistThenGet } from '../../helpers/CheckMethods';
import ApiResponse from '../../helpers/ApiResponse';
import ApiError from '../../helpers/ApiError';
import { generateVerifyCode } from '../../services/generator-code-service'
import i18n from 'i18n';
import moment from 'moment';
import Message from '../../models/message.model/message.model';
import User from '../../models/user.model/user.model';
import socketEvents from '../../socketEvents'
let populateQuery = [
    { path: 'user', model: 'user' },
    { path: 'respondingBy', model: 'user' }
];


let countUnInformed = async () => {
    try {
        let count = await Complaint.count({ deleted: false, adminInformed:  false  });
        adminNSP.emit(socketEvents.ComplaintCount, { count: count });
    } catch (error) {
        throw error;
    }
}

export default {
    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let query = { deleted: false };
            let { status, user, name, title, number, month, year, archive,firebaseToken} = req.query;

            if (firebaseToken) {
                query.firebaseToken=firebaseToken
            }
            if (archive) query.deleted = true;
            if (status) query.status = status;
            if (user) query.user = user;
            if (number) query.number = number;
            if (name) query.name = { '$regex': name, '$options': 'i' };
            if (title) query.title = { '$regex': title, '$options': 'i' };

            if (month && year) {
                let date = new Date();
                month = month - 1;
                date.setMonth(month);
                date.setFullYear(year);
                let startOfDate = moment(date).startOf('month');
                let endOfDate = moment(date).endOf('month');
                query.createdAt = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) }
            }
            if (year && !month) {
                let date = new Date();
                date.setFullYear(year);
                let startOfDate = moment(date).startOf('year');
                let endOfDate = moment(date).endOf('year');
                query.createdAt = { $gte: new Date(startOfDate), $lte: new Date(endOfDate) }
            }
            let allDocs = await Complaint.find(query).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit).populate(populateQuery)
            allDocs = Complaint.schema.methods.toJSONLocalizedOnly(allDocs, i18n.getLocale());

            let totalCount = await Complaint.count(query);
            let pageCount = Math.ceil(totalCount / limit);
            res.send(new ApiResponse(allDocs, page, pageCount, limit, totalCount, req));
            // if ((req.user.type == 'ADMIN') || (req.user.type == 'SUB_ADMIN')) {
            //     await Complaint.updateMany({ deleted: false, adminInformed: false }, { $set: { adminInformed: true } });
            //     adminNSP.emit(socketEvents.ComplaintCount, { count: 0 });
            // }
        } catch (error) {
            next(error)
        }
    },

    validateBody(isUpdate = false) {
        let validations = [];
        if (!isUpdate) {
            validations = [
                body('name').not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
                body('title').not().isEmpty().withMessage(() => { return i18n.__('titleRequired') }),
                body('notes').optional().not().isEmpty().withMessage(() => { return i18n.__('notesRequired') }),


            ];
        }
        else {
            validations = [
                body('name').optional().not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
                body('title').optional().not().isEmpty().withMessage(() => { return i18n.__('titleRequired') }),
                body('notes').optional().not().isEmpty().withMessage(() => { return i18n.__('notesRequired') }),

            ];
        }
        return validations;
    },

    async create(req, res, next) {
        try {
            let user = req.user;
            let validatedBody = checkValidations(req);
            validatedBody.user = user.id;
            let createdComplaint = await Complaint.create(validatedBody);
            if (!validatedBody.number) {
                createdComplaint.number = '100' + createdComplaint.id;
                await createdComplaint.save();
            }
            res.status(200).send(createdComplaint);
            await countUnInformed();
        } catch (error) {
            next(error)
        }
    },
    async findById(req, res, next) {
        try {
            let { id } = req.params;
            let { removeLanguage } = req.query;
            let complaint = await checkExistThenGet(id, Complaint, { deleted: false, populate: populateQuery });
            if (!removeLanguage) {
                complaint = await Complaint.schema.methods.toJSONLocalizedOnly(complaint, i18n.getLocale());
            }
            res.status(200).send(complaint);
        } catch (error) {
            next(error)
        }
    },
    async update(req, res, next) {
        try {
            let { id } = req.params;
            let { removeLanguage } = req.query;
            let complaint = await checkExistThenGet(id, Complaint, { deleted: false, user: req.user.id });
            let validatedBody = checkValidations(req);
            let updatedComplaint = await Complaint.findByIdAndUpdate(id, validatedBody, { new: true }).populate(populateQuery)
            if (!removeLanguage) {
                updatedComplaint = await Complaint.schema.methods.toJSONLocalizedOnly(updatedComplaint, i18n.getLocale());
            }
            res.status(200).send(updatedComplaint);
        } catch (error) {
            next(error)
        }
    },
    async delete(req, res, next) {
        try {
            let { id } = req.params;
            let complaint = await checkExistThenGet(id, Complaint, { deleted: false });
            complaint.deleted = true;
            await complaint.save();
            res.status(200).send('Deleted Successfully');
            await Message.updateMany({ deleted: false, complaint: id }, { deleted: true })
        } catch (error) {
            next(error)
        }
    },
    validateChangeStatus() {
        return [
            body('status').not().isEmpty().withMessage(() => { return i18n.__('statusRequired') })
                .isIn(['RESPONDING', 'ANSWERED']).withMessage(() => { return i18n.__('wrongType') })
        ]
    },

    async changeStatus(req, res, next) {
        try {
            let user = req.user;
            if ((user.type != 'ADMIN') && (user.type != 'SUB_ADMIN')) {
                return next(new ApiError(403, i18n.__('unauth')));
            }
            let { id } = req.params;
            let complaint = await checkExistThenGet(id, Complaint, { deleted: false, status: { $in: ['WAITING', 'RESPONDING'] } });
            let validatedBody = checkValidations(req);
            validatedBody.respondingBy = user.id;
            complaint = await Complaint.findByIdAndUpdate(id, validatedBody, { new: true });
            res.status(200).send(complaint)
        } catch (error) {
            next(error);
        }
    },
    countUnInformed,


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
            await Complaint.updateMany({ _id: { $in: validatedBody.ids }, deleted: false }, { deleted: true, deletedDate: new Date() })
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    },

    validateVisitor() {
        let  validations = [
                body('name').not().isEmpty().withMessage(() => { return i18n.__('nameRequired') }),
                body('title').not().isEmpty().withMessage(() => { return i18n.__('titleRequired') }),
                body('notes').optional().not().isEmpty().withMessage(() => { return i18n.__('notesRequired') }),
                body('firebaseToken').not().isEmpty().withMessage(() => { return i18n.__('firebaseTokenRequired') }),
            ];
        
        return validations;
    },

    async createVisitorComplain(req, res, next) {
        try {
            let validatedBody = checkValidations(req);
            
            let createdComplaint = await Complaint.create(validatedBody);
            if (!validatedBody.number) {
                createdComplaint.number = '100' + createdComplaint.id;
                await createdComplaint.save();
            }
            res.status(200).send(createdComplaint);
            await countUnInformed();
        } catch (error) {
            next(error)
        }
    }, 
}
