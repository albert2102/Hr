import express from 'express';
const router = express.Router();

import ruleRoute from './rule.route/rule.route';
import assignRuleRoute from './assignRule.route/assignRule.route';
import userRoute from './user.route/user.route';


router.use('/',userRoute);
router.use('/rules',ruleRoute);
router.use('/assigRule',assignRuleRoute);

export default router;