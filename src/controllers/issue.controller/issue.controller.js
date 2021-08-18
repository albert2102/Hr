import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExist, checkExistThenGet } from "../../helpers/CheckMethods";
import { checkValidations, createPromise, fieldhandleImg } from "../shared.controller/shared.controller";
import { body } from "express-validator/check";
import Issue from "../../models/issue.model/issue.model";
import Advertisments from '../../models/advertisments.model/advertisments.model';
import i18n from 'i18n'
import moment from 'moment';
import config from "../../config";
import socketEvents from '../../socketEvents'

const populateQuery = [
    { path: 'user', model: 'user' },
    { path: 'advertisment', model: 'advertisments' }

];

let countNew = async () => {
    try {
        let count = await Issue.count({ deleted: false, adminSeen: false });
        adminNSP.emit(socketEvents.IssueCount, { count: count });
    } catch (error) {
        throw error;
    }
}
export default {

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let { user, month, year, advertisment } = req.query
            let query = { deleted: false };
            if (advertisment) query.advertisment = advertisment;
            if (user) query.user = user;
            let date = new Date();
            if (month && year) {
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
            let IssueCount = await Issue.count(query);

            let pageCount = Math.ceil(IssueCount / limit);
            let issues = await Issue.find(query).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit).populate(populateQuery)
            issues = Issue.schema.methods.toJSONLocalizedOnly(issues, i18n.getLocale());

            res.send(new ApiResponse(issues, page, pageCount, limit, IssueCount, req));
            if (req.user.type == 'ADMIN' || req.user.type == 'SUB_ADMIN') {
                await Issue.updateMany({adminSeen: false ,...query}, { $set: { adminSeen: true } });
                adminNSP.emit(socketEvents.IssueCount, { count: 0 });
            }
        } catch (err) {
            next(err);
        }
    },

    validateBody(isUpdate = false) {
        let validations = [];
        if (!isUpdate) {
            validations = [
                body('text').optional().not().isEmpty().withMessage(() => { return i18n.__('textRequired') }),
                body('advertisment').not().isEmpty().withMessage(() => { return i18n.__('advertismentRequired') })
                    .custom(async (val, { req }) => {
                        req.advertisment = await checkExistThenGet(val, Advertisments, { deleted: false });
                        return true;
                    })
            ];
        }
        else {
            validations =
                [
                    body('text').optional().not().isEmpty().withMessage(() => { return i18n.__('textRequired') }),
                    body('advertisment').optional().not().isEmpty().withMessage(() => { return i18n.__('advertismentRequired') })
                        .custom(async (val, { req }) => {
                            req.advertisment = await checkExistThenGet(val, Advertisments, { deleted: false });
                            return true;
                        })
                ];
        }
        return validations;
    },

    async create(req, res, next) {
        try {
            let user = req.user;
            let adv = req.advertisment;
            console.log(adv)
            let validatedBody = checkValidations(req);
            validatedBody.user = user.id;
            let createdissue = await Issue.create(validatedBody);
            createdissue = Issue.schema.methods.toJSONLocalizedOnly(createdissue, i18n.getLocale());
            res.status(200).send(createdissue);
            await countNew();
            await Advertisments.findByIdAndUpdate(adv.id,{issuesCount:adv.issuesCount + 1})

        } catch (err) {
            console.log(err);
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { issueId } = req.params;
            let { removeLanguage } = req.query;
            let issue = await checkExistThenGet(issueId, Issue, { deleted: false, populate: populateQuery });
            if (!removeLanguage) {
                issue = Issue.schema.methods.toJSONLocalizedOnly(issue, i18n.getLocale());
            }
            res.status(200).send(issue);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let { issueId } = req.params;
            let { removeLanguage } = req.query;
            await checkExistThenGet(issueId, Issue, { deleted: false });
            let validatedBody = checkValidations(req);

            let updatedissue = await Issue.findByIdAndUpdate(issueId, validatedBody, { new: true }).populate(populateQuery);
            if (!removeLanguage) {
                updatedissue = Issue.schema.methods.toJSONLocalizedOnly(updatedissue, i18n.getLocale());
            }
            res.status(200).send(updatedissue);
        }
        catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let { issueId } = req.params;
            let issue = await checkExistThenGet(issueId, Issue, { deleted: false });
            issue.deleted = true;
            await issue.save();
            res.status(200).send('Deleted Successfully');
            let adv = await Advertisments.findById(issue.advertisment);
            await Advertisments.findByIdAndUpdate(adv.id,{issuesCount: adv.issuesCount - 1})

        }
        catch (err) {
            next(err);
        }
    },

    countNew
};