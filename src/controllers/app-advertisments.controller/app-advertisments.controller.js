
import Advertisments from '../../models/app-advertisments.model/app-advertisments.model';
import ApiResponse from "../../helpers/ApiResponse";
import { checkExistThenGet, checkExist } from "../../helpers/CheckMethods";
import { body } from 'express-validator/check';
import { checkValidations, handleImg } from "../shared.controller/shared.controller";
import i18n from 'i18n';
import ApiError from '../../helpers/ApiError';

export default {

    async find(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;

            let {type,numberOfSlots} = req.query

            let query = {  deleted: false };
            if (numberOfSlots) {
               query.numberOfSlots = numberOfSlots
            }
            if (type) {
                query.type = type
             }

            let advertisment = await Advertisments.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip((page - 1) * limit);

            const advertismentCount = await Advertisments.count(query);
            const pageCount = Math.ceil(advertismentCount / limit);
            res.status(200).send(new ApiResponse(advertisment, page, pageCount, limit, advertismentCount, req));
        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            let validatedBody = {};
            
            if(req.file)
                validatedBody.image =await handleImg(req,{attributeName:'image'}) ;
            let advertisment = await Advertisments.create(validatedBody);
            res.status(200).send(advertisment);
        } catch (error) {
            next(error)
        }
    },

    async update(req, res, next) {
        try {
            let validatedBody = {};
            let { AdvertismentsId } = req.params;
            let advertisment = await checkExistThenGet(AdvertismentsId, Advertisments, { deleted: false});
            if(req.file)
                validatedBody.image = handleImg(req,{attributeName:'image'}) ;
            advertisment = await Advertisments.findByIdAndUpdate(AdvertismentsId , validatedBody , {new:true});
            res.status(200).send(advertisment);
        } catch (error) {
            next(error)
        }
    },

    async findById(req, res, next) {
        try {
            let { AdvertismentsId } = req.params;
            let advertisment = await checkExistThenGet(AdvertismentsId, Advertisments, { deleted: false});
            res.status(200).send(advertisment);
        }
        catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let { AdvertismentsId } = req.params;
            let advertisment = await checkExistThenGet(AdvertismentsId, Advertisments, { deleted: false  });
            advertisment.deleted = true;
            await advertisment.save();
            res.status(200).send("Deleted Successfully");
        }
        catch (err) {
            next(err);
        }
    }
}

