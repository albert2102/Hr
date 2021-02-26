import Rules from '../../models/rule.model/rule.model';
import {body} from 'express-validator/check';
import ApiResponse from "../../helpers/ApiResponse";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { checkValidations } from "../shared.controller/shared.controller";
import i18n  from 'i18n'


export default {

    validate(isUpdate = false){
        if(!isUpdate){
            let validations = [
                body('name').not().isEmpty().withMessage(()=>{return i18n.__('nameRequired')})
                .custom(async (val, { req }) => {
                    let query = { name: val, deleted: false };
                    let rule = await Rules.findOne(query).lean();
                    if (rule)
                        throw new Error('name is duplicated');
                    return true;
                }),
                body('number').not().isEmpty().withMessage(()=>{return i18n.__('numberRequired')})
                .custom(async (val, { req }) => {
                    let query = { number: val, deleted: false };
                    let rule = await Rules.findOne(query).lean();
                    if (rule)
                        throw new Error('number is duplicated');
                    return true;
                }),
                body('properties').not().isEmpty().withMessage(() => { return i18n.__('propertiesRequired') }).isArray().custom(async (val, { req }) => {
                    for (let index = 0; index < val.length; index++) {
                        if (val[index] !== "ADD" && val[index] !== "UPDATE" && val[index] !== "SHOW" && val[index] !== "DELETE" && val[index] !== "STATUS")
                            throw i18n.__('userTypeWrong');
                    }
                }),
            ]
            return validations
        }
        else{
            let validations = [
                body('name').optional().not().isEmpty().withMessage(()=>{return i18n.__('nameRequired')})
                .custom(async (val, { req }) => {
                    let query = { name: val, deleted: false , _id: { $ne: req.params.ruleId }};
                    let rule = await Rules.findOne(query).lean();
                    if (rule)
                        throw new Error('name is duplicated');
                    return true;
                }),
                body('number').optional().not().isEmpty().withMessage(()=>{return i18n.__('numberRequired')})
                .custom(async (val, { req }) => {
                    let query = { number: val, deleted: false ,_id: { $ne: req.params.ruleId }};
                    let rule = await Rules.findOne(query).lean();
                    if (rule)
                        throw new Error('number is duplicated');
                    return true;
                }),
                body('properties').optional().not().isEmpty().withMessage(() => { return i18n.__('propertiesRequired') }).isArray().custom(async (val, { req }) => {
                    for (let index = 0; index < val.length; index++) {
                        if (val[index] !== "ADD" && val[index] !== "UPDATE" && val[index] !== "SHOW" && val[index] !== "DELETE" && val[index] !== "STATUS")
                            throw i18n.__('userTypeWrong');
                    }
                }),
            ]
           return validations
        }
    },

    async create (req,res,next){
        try {
            let data = checkValidations(req);
            let rules = await Rules.create(data);
            res.status(201).send(rules);
        } catch (error) {
            next(error);
        }        
    },

    async findById(req,res,next){
        try {
            let { ruleId } = req.params;
            let rules = await checkExistThenGet(ruleId,Rules,{deleted:false});
            res.status(200).send(rules);
        } catch (error) {
            next(error);
        }
    },

    async findAll (req,res,next){
        try {
            let page = +req.query.page || 1,
                limit = +req.query.limit || 20,
                skip = (page-1)*limit;
            let query = {deleted:false}
            let {name , number , admin } = req.query; 
            if (name) 
                query.name = { '$regex': name, '$options': 'i' } 
            if (number) 
                query.number = number;
            
            let ruless = await Rules.find(query).sort({_id:-1}).skip(skip).limit(limit);
            if(admin){
                ruless = await Rules.find(query).sort({_id:-1})
            }else{
                ruless = await Rules.find(query).sort({_id:-1}).skip(skip).limit(limit);
            }
            let rulesCount = await Rules.count(query);
            let pageCount = Math.ceil(rulesCount/limit);
            
            res.status(200).send(new ApiResponse(ruless,page,pageCount,limit,rulesCount,req))
        } catch (error) {
            next(error)
        }
    },

    async update (req,res,next){
        try {
            let {ruleId} = req.params;
            await checkExist(ruleId,Rules,{deleted:false});
            let data = checkValidations(req);
            let updatedrules = await Rules.findByIdAndUpdate(ruleId,data,{new:true});
            res.status(200).send(updatedrules)
            
        } catch (error) {
            next(error);
        }
    },

    async delete (req,res,next){
        try {
            let {ruleId} = req.params;
            let rules = await checkExistThenGet(ruleId,Rules,{deleted:false});
            rules.deleted = true;
            await rules.save()
            res.status(200).send('Deleted Successfully');
        } catch (error) {
            next(error);
        }
    }

}