import ApiResponse from "../../helpers/ApiResponse";
import ApiError from '../../helpers/ApiError';
import Company from "../../models/company.model/company.model";
import { checkExist, checkExistThenGet } from "../../helpers/CheckMethods";
import { checkValidations, fieldhandleImg } from "../shared.controller/shared.controller";
import { body } from "express-validator/check";
import i18n from 'i18n'
import dotObject from 'dot-object'
import socketEvents from '../../socketEvents'

export default {

    async findAll(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 20;
            let { removeLanguage } = req.query

            let query = { deleted: false };
            let companies = await Company.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip((page - 1) * limit);
            if (!removeLanguage) {
                companies = Company.schema.methods.toJSONLocalizedOnly(companies, i18n.getLocale());
            }
            const companiesCount = await Company.count(query);
            const pageCount = Math.ceil(companiesCount / limit);

            res.send(new ApiResponse(companies, page, pageCount, limit, companiesCount, req));

        } catch (err) {
            next(err);
        }
    },

    validateBody(isUpdate = false) {
        let validations = [];
        if (!isUpdate) {
            validations = [
    
                body('contactusReasons').not().isEmpty().withMessage(() => { return i18n.__('contactusReasonsRequired') }).isArray().withMessage('Must Be Array'),
                body('contactusReasons.*.ar').not().isEmpty().withMessage(() => { return i18n.__('arcontactusReasonsRequired') }),
                body('contactusReasons.*.en').not().isEmpty().withMessage(() => { return i18n.__('encontactusReasonsRequired') }),

                body('instructionsForUse').not().isEmpty().withMessage(() => { return i18n.__('instructionsForUseRequired') }).isArray().withMessage('Must Be Array'),
                body('instructionsForUse.*.title.ar').not().isEmpty().withMessage(() => { return i18n.__('arinstructionsForUseRequired') }),
                body('instructionsForUse.*.title.en').not().isEmpty().withMessage(() => { return i18n.__('eninstructionsForUseRequired') }),
                body('instructionsForUse.*.description.ar').not().isEmpty().withMessage(() => { return i18n.__('arinstructionsForUseRequired') }),
                body('instructionsForUse.*.description.en').not().isEmpty().withMessage(() => { return i18n.__('eninstructionsForUseRequired') }),


                body('androidUrl').not().isEmpty().withMessage(() => { return i18n.__('androidUrlRequired') }),
                body('iosUrl').not().isEmpty().withMessage(() => { return i18n.__('iosUrlRequired') }),

                body('socialLinks').not().isEmpty().withMessage(() => { return i18n.__('socialLinksRequired') })
                    .isArray().withMessage(() => { return i18n.__('socialLinksValueError') }),
                body('socialLinks.*.key').not().isEmpty().withMessage(() => { return i18n.__('socialLinksRequired') }),
                body('socialLinks.*.value').not().isEmpty().withMessage(() => { return i18n.__('socialLinksRequired') }),

                body('location.long').not().isEmpty().withMessage(() => { return i18n.__('longitudeRequired') }),
                body('location.lat').not().isEmpty().withMessage(() => { return i18n.__('latitudeRequired') }),
                body('location.address').not().isEmpty().withMessage(() => { return i18n.__('addressRequired') }),

                body('fixedCategoryName').not().isEmpty().withMessage(() => { return i18n.__('categoryRequired') }),
                body('fixedCategoryName.ar').not().isEmpty().withMessage(() => { return i18n.__('arCategoryRequired') }),
                body('fixedCategoryName.en').not().isEmpty().withMessage(() => { return i18n.__('enCategoryRequired') }),
                
                body('traderWaitingTime').not().isEmpty().withMessage(() => { return i18n.__('traderWaitingTimeRequired') }),
                body('driverWaitingTime').not().isEmpty().withMessage(() => { return i18n.__('driverWaitingTimeRequired') }),

                body('transportPrice').optional().not().isEmpty().withMessage(() => { return i18n.__('transportPriceRequired') }),
                body('taxes').optional().not().isEmpty().withMessage(() => { return i18n.__('taxesRequired') }),

                body('commissionAgreement').not().isEmpty().withMessage(() => { return i18n.__('commissionAgreementRequired') }),
                body('commissionAgreement.ar').not().isEmpty().withMessage(() => { return i18n.__('arCommissionAgreementRequired') }),
                body('commissionAgreement.en').not().isEmpty().withMessage(() => { return i18n.__('enCommissionAgreementRequired') }),

                body('driver_androidUrl').not().isEmpty().withMessage(() => { return i18n.__('driver_androidUrlRequired') }),
                body('driver_iosUrl').not().isEmpty().withMessage(() => { return i18n.__('driver_iosUrlRequired') }),

                body('store_androidUrl').not().isEmpty().withMessage(() => { return i18n.__('store_androidUrlRequired') }),
                body('store_iosUrl').not().isEmpty().withMessage(() => { return i18n.__('store_iosUrlRequired') }),
                body('numberOfRowsForAdvertisments').not().isEmpty().withMessage(() => { return i18n.__('numberOfRowsForAdvertismentsRequired') }),
                
            ];
        }
        else {
            validations = [
                body('contactusReasons').optional().not().isEmpty().withMessage(() => { return i18n.__('contactusReasonsRequired') }).isArray().withMessage('Must Be Array'),
                body('contactusReasons.*.ar').not().isEmpty().withMessage(() => { return i18n.__('arcontactusReasonsRequired') }),
                body('contactusReasons.*.en').not().isEmpty().withMessage(() => { return i18n.__('encontactusReasonsRequired') }),

                body('numberOfRowsForAdvertisments').optional().not().isEmpty().withMessage(() => { return i18n.__('numberOfRowsForAdvertismentsRequired') }),
                body('fixedCategoryName').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryRequired') }),
                body('fixedCategoryName.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('arCategoryRequired') }),
                body('fixedCategoryName.en').optional().not().isEmpty().withMessage(() => { return i18n.__('enCategoryRequired') }),
                body('traderWaitingTime').optional().not().isEmpty().withMessage(() => { return i18n.__('traderWaitingTimeRequired') }),
                body('driverWaitingTime').optional().not().isEmpty().withMessage(() => { return i18n.__('driverWaitingTimeRequired') }),

                body('instructionsForUse').optional().not().isEmpty().withMessage(() => { return i18n.__('instructionsForUseRequired') }).isArray().withMessage('Must Be Array'),
                body('instructionsForUse.*.title.ar').not().isEmpty().withMessage(() => { return i18n.__('arinstructionsForUseRequired') }),
                body('instructionsForUse.*.title.en').not().isEmpty().withMessage(() => { return i18n.__('eninstructionsForUseRequired') }),
                body('instructionsForUse.*.description.ar').not().isEmpty().withMessage(() => { return i18n.__('arinstructionsForUseRequired') }),
                body('instructionsForUse.*.description.en').not().isEmpty().withMessage(() => { return i18n.__('eninstructionsForUseRequired') }),

                body('androidUrl').optional().not().isEmpty().withMessage(() => { return i18n.__('androidUrlRequired') }),
                body('iosUrl').optional().not().isEmpty().withMessage(() => { return i18n.__('iosUrlRequired') }),

                body('socialLinks').optional().not().isEmpty().withMessage(() => { return i18n.__('socialLinksRequired') })
                    .isArray().withMessage(() => { return i18n.__('mustBeArray') }),
                body('socialLinks.*.key').not().isEmpty().withMessage(() => { return i18n.__('socialLinksRequired') }),
                body('socialLinks.*.value').not().isEmpty().withMessage(() => { return i18n.__('socialLinksRequired') }),

                body('location.long').optional().not().isEmpty().withMessage(() => { return i18n.__('longitudeRequired') }),
                body('location.lat').optional().not().isEmpty().withMessage(() => { return i18n.__('latitudeRequired') }),
                body('location.address').optional().not().isEmpty().withMessage(() => { return i18n.__('addressRequired') }),
                
                body('transportPrice').optional().not().isEmpty().withMessage(() => { return i18n.__('transportPriceRequired') }),
                body('taxes').optional().not().isEmpty().withMessage(() => { return i18n.__('taxesRequired') }),

                body('commissionAgreement').optional().not().isEmpty().withMessage(() => { return i18n.__('commissionAgreementRequired') }),
                body('commissionAgreement.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('arCommissionAgreementRequired') }),
                body('commissionAgreement.en').optional().not().isEmpty().withMessage(() => { return i18n.__('enCommissionAgreementRequired') }),

                body('driver_androidUrl').optional().not().isEmpty().withMessage(() => { return i18n.__('driver_androidUrlRequired') }),
                body('driver_iosUrl').optional().not().isEmpty().withMessage(() => { return i18n.__('driver_iosUrlRequired') }),

                body('store_androidUrl').optional().not().isEmpty().withMessage(() => { return i18n.__('store_androidUrlRequired') }),
                body('store_iosUrl').optional().not().isEmpty().withMessage(() => { return i18n.__('store_iosUrlRequired') }),

            ];
        }
        return validations;
    },

    async create(req, res, next) {
        try {
            const validatedBody = checkValidations(req);
            if (req.files && req.files['logo'] && req.files['logo'].length > 0) {
                validatedBody.logo = fieldhandleImg(req, { attributeName: 'logo' })
            }
            if (req.files && req.files['fixedCategoryIcon'] && req.files['fixedCategoryIcon'].length > 0) {
                let fixedCategoryIcon = fieldhandleImg(req, { attributeName: 'fixedCategoryIcon' });
                validatedBody.fixedCategoryIcon = fixedCategoryIcon;
            }
            else{
                next(new ApiError(400,'fixed category icon required'))
            }

            await Company.updateMany({ deleted: false }, { deleted: true });
            let createdCompany = await Company.create(validatedBody);
            res.status(201).send(createdCompany);
        } catch (err) {
            next(err);
        }
    },

    async findById(req, res, next) {
        try {
            let { companyId } = req.params;
            let { removeLanguage } = req.query;
            let company = await checkExistThenGet(companyId, Company, { deleted: false });
            if (!removeLanguage) {
                company = Company.schema.methods.toJSONLocalizedOnly(company, i18n.getLocale());
            }
            res.send(company);
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            let { companyId } = req.params;
            await checkExist(companyId, Company, { deleted: false });
            let validatedBody = checkValidations(req);
            console.log(validatedBody)
            let data = {}
            if (validatedBody.socialLinks) {
                data.socialLinks = validatedBody.socialLinks;
                delete validatedBody.socialLinks
            }
            if (validatedBody.instructionsForUse) {
                data.instructionsForUse = validatedBody.instructionsForUse;
                delete validatedBody.instructionsForUse;
            }
            if (validatedBody.contactusReasons) {
                data.contactusReasons = validatedBody.contactusReasons;
                delete validatedBody.contactusReasons;
            }
            if (validatedBody.commissionAgreement) {
                data.commissionAgreement = validatedBody.commissionAgreement;
                delete validatedBody.commissionAgreement;
            }
            if (validatedBody.fixedCategoryName) {
                data.fixedCategoryName = validatedBody.fixedCategoryName;
                delete validatedBody.fixedCategoryName;
            }

            if (req.files && req.files['logo'] && req.files['logo'].length > 0) {
                validatedBody.logo = (fieldhandleImg(req, { attributeName: 'logo' }))[0]
            }

            if (req.files && req.files['fixedCategoryIcon'] && req.files['fixedCategoryIcon'].length > 0) {
                let fixedCategoryIcon = fieldhandleImg(req, { attributeName: 'fixedCategoryIcon' });
                validatedBody.fixedCategoryIcon = fixedCategoryIcon;
            }
            validatedBody = dotObject.dot(validatedBody);

            let updatedCompany = await Company.findByIdAndUpdate(companyId, { ...validatedBody, ...data }, { new: true });
            res.status(200).send(updatedCompany);
            notificationNSP.emit(socketEvents.Company, { company: updatedCompany });
        }
        catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            let { companyId } = req.params;
            let company = await checkExistThenGet(companyId, Company, { deleted: false });
            company.deleted = true;
            await company.save();
            res.status(200).send('delete success');
        }
        catch (err) {
            next(err);
        }
    },

    async share(req, res, next) {
        try {
            let company = await Company.findOne({ deleted: false });
            if (!company) {
                res.status(200).send('Done');
            }
            company.appShareCount = company.appShareCount + 1
            await company.save()
            res.status(200).send('Done');
        } catch (error) {
            next(error)
        }
    }
};