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
                body('footerText').not().isEmpty().withMessage(() => { return i18n.__('footerTextRequired') }),
                body('footerText.ar').not().isEmpty().withMessage(() => { return i18n.__('arfooterTextRequired') }),
                body('footerText.en').not().isEmpty().withMessage(() => { return i18n.__('enfooterTextRequired') }),

                body('instructionsForUse').not().isEmpty().withMessage(() => { return i18n.__('instructionsForUseRequired') }).isArray().withMessage('Must Be Array'),
                body('instructionsForUse.*.ar').not().isEmpty().withMessage(() => { return i18n.__('arinstructionsForUseRequired') }),
                body('instructionsForUse.*.en').not().isEmpty().withMessage(() => { return i18n.__('eninstructionsForUseRequired') }),

                body('privacy').not().isEmpty().withMessage(() => { return i18n.__('privacyRequired') }).isArray().withMessage('Must Be Array'),
                body('privacy.*.ar').not().isEmpty().withMessage(() => { return i18n.__('arPrivacyRequired') }),
                body('privacy.*.en').not().isEmpty().withMessage(() => { return i18n.__('enPrivacyRequired') }),

                body('aboutUs').not().isEmpty().withMessage(() => { return i18n.__('arAboutUsRequired') }).isArray().withMessage('Must Be Array'),
                body('aboutUs.*.ar').not().isEmpty().withMessage(() => { return i18n.__('arAboutUsRequired') }),
                body('aboutUs.*.en').not().isEmpty().withMessage(() => { return i18n.__('enAboutUsRequired') }),

                body('returnPolicy').not().isEmpty().withMessage(() => { return i18n.__('arReturnPolicyRequired') }).isArray().withMessage('Must Be Array'),
                body('returnPolicy.*.ar').not().isEmpty().withMessage(() => { return i18n.__('arReturnPolicyRequired') }),
                body('returnPolicy.*.en').not().isEmpty().withMessage(() => { return i18n.__('enReturnPolicyRequired') }),
                
                body('email').not().isEmpty().withMessage(() => { return i18n.__('emailRequired') }),
                body('phone').not().isEmpty().withMessage(() => { return i18n.__('phoneRequired') }),
                body('landlinePhone').not().isEmpty().withMessage(() => { return i18n.__('landlinePhoneRequired') }),
                body('whatsappNumber').not().isEmpty().withMessage(() => { return i18n.__('whatsappNumberRequired') }),
                body('androidUrl').not().isEmpty().withMessage(() => { return i18n.__('androidUrlRequired') }),
                body('iosUrl').not().isEmpty().withMessage(() => { return i18n.__('iosUrlRequired') }),

                body('socialLinks').not().isEmpty().withMessage(() => { return i18n.__('socialLinksRequired') })
                    .isArray().withMessage(() => { return i18n.__('socialLinksValueError') }),
                body('socialLinks.*.key').not().isEmpty().withMessage(() => { return i18n.__('socialLinksRequired') }),
                body('socialLinks.*.value').not().isEmpty().withMessage(() => { return i18n.__('socialLinksRequired') }),

                body('location.long').not().isEmpty().withMessage(() => { return i18n.__('longitudeRequired') }),
                body('location.lat').not().isEmpty().withMessage(() => { return i18n.__('latitudeRequired') }),
                body('location.address').not().isEmpty().withMessage(() => { return i18n.__('addressRequired') }),
                body('minimumOrder').not().isEmpty().withMessage(() => { return i18n.__('minimumOrderRequired') }),
                body('minimumOrderTime').not().isEmpty().withMessage(() => { return i18n.__('minimumOrderTimeRequired') }),

                body('firstCategory').not().isEmpty().withMessage(() => { return i18n.__('categoryRequired') }),
                body('firstCategory.name').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryNameRequired') }),
                body('firstCategory.name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryNameArRequired') }),
                body('firstCategory.name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('catrgoryNameEnRequired') }),
                
                body('secondCategory').not().isEmpty().withMessage(() => { return i18n.__('categoryRequired') }),
                body('secondCategory.name').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryNameRequired') }),
                body('secondCategory.name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryNameArRequired') }),
                body('secondCategory.name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('catrgoryNameEnRequired') }),

                body('thirdCategory').not().isEmpty().withMessage(() => { return i18n.__('categoryRequired') }),
                body('thirdCategory.name').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryNameRequired') }),
                body('thirdCategory.name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryNameArRequired') }),
                body('thirdCategory.name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('catrgoryNameEnRequired') }),

                body('transportPrice').optional().not().isEmpty().withMessage(() => { return i18n.__('transportPriceRequired') }),
                body('taxes').optional().not().isEmpty().withMessage(() => { return i18n.__('taxesRequired') }),
            ];
        }
        else {
            validations = [
                body('numberOfRowsForAdvertisments').optional().not().isEmpty().withMessage(() => { return i18n.__('numberOfRowsForAdvertismentsRequired') }),
                
                body('footerText').optional().not().isEmpty().withMessage(() => { return i18n.__('footerTextRequired') }),
                body('footerText.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('arfooterTextRequired') }),
                body('footerText.en').optional().not().isEmpty().withMessage(() => { return i18n.__('enfooterTextRequired') }),

                body('instructionsForUse').optional().not().isEmpty().withMessage(() => { return i18n.__('instructionsForUseRequired') }).isArray().withMessage('Must Be Array'),
                body('instructionsForUse.*.ar').not().isEmpty().withMessage(() => { return i18n.__('arinstructionsForUseRequired') }),
                body('instructionsForUse.*.en').not().isEmpty().withMessage(() => { return i18n.__('eninstructionsForUseRequired') }),

                body('privacy').optional().not().isEmpty().withMessage(() => { return i18n.__('privacyRequired') }).isArray().withMessage('Must Be Array'),
                body('privacy.*.ar').not().isEmpty().withMessage(() => { return i18n.__('arPrivacyRequired') }),
                body('privacy.*.en').not().isEmpty().withMessage(() => { return i18n.__('enPrivacyRequired') }),

                body('aboutUs').optional().not().isEmpty().withMessage(() => { return i18n.__('arAboutUsRequired') }).isArray().withMessage('Must Be Array'),
                body('aboutUs.*.ar').not().isEmpty().withMessage(() => { return i18n.__('arAboutUsRequired') }),
                body('aboutUs.*.en').not().isEmpty().withMessage(() => { return i18n.__('enAboutUsRequired') }),

                body('returnPolicy').optional().not().isEmpty().withMessage(() => { return i18n.__('arReturnPolicyRequired') }).isArray().withMessage('Must Be Array'),
                body('returnPolicy.*.ar').not().isEmpty().withMessage(() => { return i18n.__('arReturnPolicyRequired') }),
                body('returnPolicy.*.en').not().isEmpty().withMessage(() => { return i18n.__('enReturnPolicyRequired') }),

                body('email').optional().not().isEmpty().withMessage(() => { return i18n.__('emailRequired') }),
                body('phone').optional().not().isEmpty().withMessage(() => { return i18n.__('phoneRequired') }),
                body('landlinePhone').optional().not().isEmpty().withMessage(() => { return i18n.__('landlinePhoneRequired') }),
                body('whatsappNumber').optional().not().withMessage(() => { return i18n.__('whatsappNumberRequired') }),
                body('androidUrl').optional().not().isEmpty().withMessage(() => { return i18n.__('androidUrlRequired') }),
                body('iosUrl').optional().not().isEmpty().withMessage(() => { return i18n.__('iosUrlRequired') }),

                body('socialLinks').optional().not().isEmpty().withMessage(() => { return i18n.__('socialLinksRequired') })
                    .isArray().withMessage(() => { return i18n.__('mustBeArray') }),
                body('socialLinks.*.key').not().isEmpty().withMessage(() => { return i18n.__('socialLinksRequired') }),
                body('socialLinks.*.value').not().isEmpty().withMessage(() => { return i18n.__('socialLinksRequired') }),

                body('location.long').optional().not().isEmpty().withMessage(() => { return i18n.__('longitudeRequired') }),
                body('location.lat').optional().not().isEmpty().withMessage(() => { return i18n.__('latitudeRequired') }),
                body('location.address').optional().not().isEmpty().withMessage(() => { return i18n.__('addressRequired') }),
                body('minimumOrder').optional().not().isEmpty().withMessage(() => { return i18n.__('minimumOrderRequired') }),
                body('minimumOrderTime').optional().not().isEmpty().withMessage(() => { return i18n.__('minimumOrderTimeRequired') }),

                body('firstCategory').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryRequired') }),
                body('firstCategory.name').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryNameRequired') }),
                body('firstCategory.name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryNameArRequired') }),
                body('firstCategory.name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('catrgoryNameEnRequired') }),
                
                body('secondCategory').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryRequired') }),
                body('secondCategory.name').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryNameRequired') }),
                body('secondCategory.name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryNameArRequired') }),
                body('secondCategory.name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('catrgoryNameEnRequired') }),

                body('thirdCategory').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryRequired') }),
                body('thirdCategory.name').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryNameRequired') }),
                body('thirdCategory.name.ar').optional().not().isEmpty().withMessage(() => { return i18n.__('categoryNameArRequired') }),
                body('thirdCategory.name.en').optional().not().isEmpty().withMessage(() => { return i18n.__('catrgoryNameEnRequired') }),

                body('transportPrice').optional().not().isEmpty().withMessage(() => { return i18n.__('transportPriceRequired') }),
                body('taxes').optional().not().isEmpty().withMessage(() => { return i18n.__('taxesRequired') }),

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
            if (req.files && req.files['firstCategoryIcon'] && req.files['firstCategoryIcon'].length > 0) {
                let firstCategoryIcon = fieldhandleImg(req, { attributeName: 'firstCategoryIcon' });
                validatedBody.firstCategory.icon = firstCategoryIcon;
            }
            // else{
            //     next(new ApiError(400,'first category icon required'))
            // }
            if (req.files && req.files['firstCategoryImage'] && req.files['firstCategoryImage'].length > 0) {
                let firstCategoryImage = fieldhandleImg(req, { attributeName: 'firstCategoryImage' });
                validatedBody.firstCategory.image = firstCategoryImage;
            }
            // else{
            //     next(new ApiError(400,'first category image required'))
            // }
            if (req.files && req.files['secondCategoryIcon'] && req.files['secondCategoryIcon'].length > 0) {
                let secondCategoryIcon = fieldhandleImg(req, { attributeName: 'secondCategoryIcon' });
                validatedBody.secondCategory.icon = secondCategoryIcon;
            }
            // else{
            //     next(new ApiError(400,'second category icon required'))
            // }
            if (req.files && req.files['secondCategoryImage'] && req.files['secondCategoryImage'].length > 0) {
                let secondCategoryImage = fieldhandleImg(req, { attributeName: 'secondCategoryImage' });
                validatedBody.secondCategory.image = secondCategoryImage;
            }
            // else{
            //     next(new ApiError(400,'second category image required'))
            // }
            if (req.files && req.files['thirdCategoryIcon'] && req.files['thirdCategoryIcon'].length > 0) {
                let thirdCategoryIcon = fieldhandleImg(req, { attributeName: 'thirdCategoryIcon' });
                validatedBody.thirdCategory.icon = thirdCategoryIcon;
            }
            // else{
            //     next(new ApiError(400,'third category icon required'))
            // }
            if (req.files && req.files['thirdCategoryImage'] && req.files['thirdCategoryImage'].length > 0) {
                let thirdCategoryImage = fieldhandleImg(req, { attributeName: 'thirdCategoryImage' });
                validatedBody.thirdCategory.image = thirdCategoryImage;
            }
            // else{
            //     next(new ApiError(400,'third category image required'))
            // }
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
            if (validatedBody.privacy) {
                data.privacy = validatedBody.privacy;
                delete validatedBody.privacy;
            }
            if (validatedBody.aboutUs) {
                data.aboutUs = validatedBody.aboutUs;
                delete validatedBody.aboutUs;
            }
            if (validatedBody.returnPolicy) {
                data.returnPolicy = validatedBody.returnPolicy;
                delete validatedBody.returnPolicy;
            }

            if (req.files && req.files['logo'] && req.files['logo'].length > 0) {
                validatedBody.logo = (fieldhandleImg(req, { attributeName: 'logo' }))[0]
            }

            if (req.files && req.files['firstCategoryIcon'] && req.files['firstCategoryIcon'].length > 0 ) {
                let firstCategoryIcon = fieldhandleImg(req, { attributeName: 'firstCategoryIcon' });
                if (validatedBody.firstCategory) {
                    validatedBody.firstCategory.icon = firstCategoryIcon[0];
                } else {
                    validatedBody['firstCategory.icon'] = firstCategoryIcon[0];
                }
            }
            if (req.files && req.files['firstCategoryImage'] && req.files['firstCategoryImage'].length > 0 ) {
                let firstCategoryImage = fieldhandleImg(req, { attributeName: 'firstCategoryImage' });
                if (validatedBody.firstCategory) {
                    validatedBody.firstCategory.image = firstCategoryImage[0];
                    
                } else {
                    validatedBody['firstCategory.image'] = firstCategoryImage[0];
                }
            }

            if (req.files && req.files['secondCategoryIcon'] && req.files['secondCategoryIcon'].length > 0 ) {
                let secondCategoryIcon = fieldhandleImg(req, { attributeName: 'secondCategoryIcon' });
                if (validatedBody.secondCategory) {
                    validatedBody.secondCategory.icon = secondCategoryIcon[0];
                } else {
                    validatedBody['secondCategory.icon'] = secondCategoryIcon[0];
                }
            }

            if (req.files && req.files['secondCategoryImage'] && req.files['secondCategoryImage'].length > 0 ) {
                let secondCategoryImage = fieldhandleImg(req, { attributeName: 'secondCategoryImage' });
                if (validatedBody.secondCategory) {
                    validatedBody.secondCategory.image = secondCategoryImage[0];
                } else {
                    validatedBody['secondCategory.image'] = secondCategoryImage[0];
                }
            }

            if (req.files && req.files['thirdCategoryIcon'] && req.files['thirdCategoryIcon'].length > 0 ) {
                let thirdCategoryIcon = fieldhandleImg(req, { attributeName: 'thirdCategoryIcon' });
                if (validatedBody.thirdCategory) {
                    validatedBody.thirdCategory.icon = thirdCategoryIcon[0];
                } else {
                    validatedBody['thirdCategory.icon'] = thirdCategoryIcon[0];
                }
            }
            if (req.files && req.files['thirdCategoryImage'] && req.files['thirdCategoryImage'].length > 0 ) {
                let thirdCategoryImage = fieldhandleImg(req, { attributeName: 'thirdCategoryImage' });
                if (validatedBody.thirdCategory) {
                    validatedBody.thirdCategory.image = thirdCategoryImage[0];
                }else{
                    validatedBody['thirdCategory.image'] = thirdCategoryImage[0];
                }
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