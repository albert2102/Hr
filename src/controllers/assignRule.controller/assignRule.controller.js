import AssignRule from "../../models/assignRule.model/assignRule.model";
import User from "../../models/user.model/user.model";
import Rule from "../../models/rule.model/rule.model";
import ApiResponse from "../../helpers/ApiResponse";
import ApiError from "../../helpers/ApiError";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { body } from 'express-validator/check';
import { checkValidations } from "../shared.controller/shared.controller";
let populateQuery = [{ path: 'rule', model: 'rule' },{ path: 'user', model: 'user' }];
import i18n from 'i18n';
import socketEvents from '../../socketEvents';

export default {
    validateBody(isUpdate = false) {
        let validations
        if (!isUpdate) {
            validations = [
                body('rule').not().isEmpty().withMessage(()=>{return i18n.__('ruleRequired')}).custom(async (val, { req }) => {
                    await checkExist(val, Rule, { deleted: false });
                    return true;
                }),
                body('user').not().isEmpty().withMessage(()=>{return i18n.__('userRequired')}).custom(async (val, { req }) => {
                    await checkExist(val, User, { deleted: false });
                    return true;
                }),
                body('properties').not().isEmpty().withMessage(() => { return i18n.__('propertiesRequired') }).isArray().custom(async (val, { req }) => {
                    for (let index = 0; index < val.length; index++) {
                        if (val[index] !== "ADD" && val[index] !== "UPDATE" && val[index] !== "SHOW" && val[index] !== "DELETE" && val[index] !== "STATUS")
                            throw i18n.__('userTypeWrong');
                    }
                }),
            ];
        }
        else {
            validations = [
                body('rule').optional().not().isEmpty().withMessage(()=>{return i18n.__('ruleRequired')}).custom(async (val, { req }) => {
                    await checkExist(val, Rule, { deleted: false });
                    return true;
                }),
                body('properties').optional().not().isEmpty().withMessage(() => { return i18n.__('propertiesRequired') }).isArray().custom(async (val, { req }) => {
                    for (let index = 0; index < val.length; index++) {
                        if (val[index] !== "ADD" && val[index] !== "UPDATE" && val[index] !== "SHOW" && val[index] !== "DELETE" && val[index] !== "STATUS")
                            throw i18n.__('userTypeWrong');
                    }
                }),
            ];

        }
        return validations;
    },

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            var { rule,user } = req.query;
            let query = { deleted: false };
            if (rule) query.rule = rule;
            if (user) query.user = user;
            let assignRules = await AssignRule.find(query).populate(populateQuery).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit);
            const assignRuleCount = await AssignRule.count(query);
            const pageCount = Math.ceil(assignRuleCount / limit);
            res.send(new ApiResponse(assignRules, page, pageCount, limit, assignRuleCount, req));


        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('admin.auth')));
            }
            let validatedBody = checkValidations(req);
            let checkExist = await AssignRule.findOne({deleted:false,rule:validatedBody.rule,user:validatedBody.user })
            if(checkExist){
                return next(new ApiError(403, i18n.__('ruleDuplicated')));                
            }
            let assignRule = await AssignRule.create(validatedBody);
            user = await User.findByIdAndUpdate(validatedBody.user,{$addToSet:{rules:assignRule.id}},{new: true})//.populate([{ path: 'rules', model: 'assignRule' }])
            res.status(200).send(assignRule);
            adminNSP.to('room-'+ validatedBody.user).emit(socketEvents.NewUser, {user, user });

        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let { assignRuleId } = req.params;
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('admin.auth')));
            }
            await checkExist(assignRuleId, AssignRule, { deleted: false });
            let validatedBody = checkValidations(req);
            let updatedAssignRule = await AssignRule.findByIdAndUpdate(assignRuleId, {
                ...validatedBody,
            }, { new: true }).populate(populateQuery);
            res.status(200).send(updatedAssignRule);
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { assignRuleId } = req.params;
            let assignRule = await checkExistThenGet(assignRuleId, AssignRule, { deleted: false,populate:populateQuery });
            res.status(200).send(assignRule);

        } catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let user = req.user;
            if (user.type != 'ADMIN' && user.type != 'SUB_ADMIN') {
                return next(new ApiError(403, ('admin.auth')));
            }
            let { assignRuleId } = req.params;
            let assignRule = await checkExistThenGet(assignRuleId, AssignRule, { deleted: false });
            assignRule.deleted = true;
            await assignRule.save();
            user = await User.findByIdAndUpdate(assignRule.user,{$pull:{rules:assignRule.id}},{new: true})//.populate([{ path: 'rules', model: 'assignRule' }])
            res.status(200).send("Deleted Successfully");
            adminNSP.to('room-'+ user.id).emit(socketEvents.NewUser, {user, user });

        }
        catch (err) {
            next(err);
        }
    }
}