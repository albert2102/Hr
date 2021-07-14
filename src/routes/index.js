import express from 'express';
const router = express.Router();

import ruleRoute from './rule.route/rule.route';
import assignRuleRoute from './assignRule.route/assignRule.route';
import contactUsRoute from './contactUs.route/contactUs.route';
import adminRoute from './admin.route/admin.route';
import userRoute from './user.route/user.route';
import categoryRouter from './category.route/category.route';
import productCategoryRouter from './product-category.route/product-category.route';
import productRouter from './product.route/product.route';
import companyRoute from './company.route/company.route';
import advertismentsRoute from './advertisment.route/advertisment.route';
import appadvertismentsRoute from './app-advertisment.route/app-advertisment.route';
import issueRoute from './issue.route/issue.route';
import favoriteRoute from './favorites.route/favorites.route';
import creditRouter from './credit.route/credit.route';
import orderRouter from './order.route/order.route'
import addressRoute from './address.route/address.route';
import shippingRoute from './shipping-card.route/shipping-card.route';
import notifRouter from './notif.route/notif.route';
import promocodeRoute from './promocode.route/promocode.route';
import chatRouter from './message.route/message.route';
import complaintRouter from './complaint.route/complaint.route';
import dashBoardRouter from './dashboard.route/dashboard.route';
import requestMoneyRouter from './requestMoneyHistory.route/requestMoneyHistory.route';
import zoneRouter from './zone.route/zone.route';

router.use('/',userRoute);
router.use('/admin',adminRoute);
router.use('/rules',ruleRoute);
router.use('/assigRule',assignRuleRoute);
router.use('/contactUs',contactUsRoute);
router.use('/category',categoryRouter);
router.use('/product-category',productCategoryRouter);
router.use('/product',productRouter);
router.use('/companies',companyRoute);
router.use('/advertisments',advertismentsRoute);
router.use('/app-advertisments',appadvertismentsRoute);
router.use('/issue',issueRoute);
router.use('/favorites',favoriteRoute);
router.use('/credit', creditRouter)
router.use('/shipping-card',shippingRoute )
router.use('/address',addressRoute);
router.use('/promocode',promocodeRoute)
router.use('/notif',notifRouter);
router.use('/order', orderRouter);
router.use('/chat', chatRouter);
router.use('/complaint', complaintRouter)
router.use('/dashboard',dashBoardRouter);
router.use('/requestMoney',requestMoneyRouter);
router.use('/zone',zoneRouter);

export default router;