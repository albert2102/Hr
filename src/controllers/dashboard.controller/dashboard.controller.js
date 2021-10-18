import User from "../../models/user.model/user.model";
import Order from "../../models/order.model/order.model";

import moment from "moment";
import i18n from 'i18n';
import appStore from 'app-store-scraper';
import googlePlay from 'google-play-scraper';

let getAppleData = async () => {
    try {
        let result = await appStore.app({ id: 1504167956 });
        // console.log(result)
        let data = {
            reviews: result.reviews,
            ratings: result.score,
            version: result.version,
            url: result.url
        }
        return data;
    } catch (error) {
        // console.log(error)
        throw error;
    }
}
let getAndroidData = async () => {
    try {
        let result = await googlePlay.app({ appId: 'com.sharbel' })
        let data = {
            installs: result.minInstalls,
            reviews: result.reviews,
            ratings: result.ratings,
            version: result.androidVersion,
            url: result.url
        }
        return data;
    } catch (error) {
        throw error;
    }
}

let createPromise = (query) => {
    let newPromise = new Promise(async (resolve, reject) => {
        try {
            const result = await query;
            resolve(result);
        } catch (error) {
            reject(error);
        }
    })
    return newPromise;
}

export default {

    async getLastUser(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 10;

            let lastUsers = await User.find({ deleted: false, type: 'CLIENT' })
                .sort({ createdAt: -1 })
                .limit(limit).skip((page - 1) * limit);

            res.send(lastUsers);
        } catch (error) {
            next(error);
        }
    },

    async count(req, res, next) {
        try {

            const users = createPromise(User.count({ deleted: false, type: 'CLIENT' }));
            const drivers = createPromise(User.count({ deleted: false, type: 'DRIVER' }));
            const institutions = createPromise(User.count({ deleted: false, type: 'INSTITUTION' }));

            const acttiveUsers = createPromise(User.count({ deleted: false, type: 'CLIENT',activated:true }));
            const inacttiveUsers = createPromise(User.count({ deleted: false, type: 'CLIENT',activated: false }));
            const activeDrivers = createPromise(User.count({ deleted: false, type: 'DRIVER',activated:true }));
            const inactiveDrivers = createPromise(User.count({ deleted: false, type: 'DRIVER',activated: false  }));
            const activeInstitutions = createPromise(User.count({ deleted: false, type: 'INSTITUTION',activated:true }));
            const inactiveInstitutions = createPromise(User.count({ deleted: false, type: 'INSTITUTION',activated: false  }));

            const waitingDrivers = createPromise(User.count({ deleted: false, type: 'DRIVER',status:'WAITING' }));
            const waitingInstitutions = createPromise(User.count({ deleted: false, type: 'INSTITUTION',status:'WAITING' }));

            const acceptedDrivers = createPromise(User.count({ deleted: false, type: 'DRIVER',status:'ACCEPTED' }));
            const acceptedInstitutions = createPromise(User.count({ deleted: false, type: 'INSTITUTION',status:'ACCEPTED' }));

            const rejectedDrivers = createPromise(User.count({ deleted: false, type: 'DRIVER',status:'REJECTED' }));
            const rejectedInstitutions = createPromise(User.count({ deleted: false, type: 'INSTITUTION',status:'REJECTED' }));

            const orders = createPromise(Order.count({ deleted: false,traderNotResponse:false,defaultOrders:true}));
            const ordersTraderNotResponse = createPromise(Order.count({ deleted: false,traderNotResponse:false }));
            const ordersTraderResponse = createPromise(Order.count({ deleted: false,traderNotResponse:true }));
            const ordersNotAssign = createPromise(Order.count({ deleted: false,status:'NOT_ASSIGN'}));
            let counts = [
                users,drivers,institutions,
                acttiveUsers,inacttiveUsers,
                activeDrivers,inactiveDrivers,
                activeInstitutions,inactiveInstitutions,
                waitingDrivers,waitingInstitutions,
                acceptedDrivers,acceptedInstitutions,
                rejectedDrivers,rejectedInstitutions,
                orders,ordersTraderNotResponse,ordersTraderResponse,ordersNotAssign
            ]
            let result = await Promise.all(counts);

            res.status(200).send(
                {
                    users: result[0],
                    drivers: result[1],
                    institutions: result[2],

                    acttiveUsers: result[3],
                    inacttiveUsers: result[4],

                    activeDrivers: result[5],
                    activeDrivers: result[6],
                    
                    activeInstitutions: result[7],
                    inactiveInstitutions: result[8],

                    waitingDrivers: result[9],
                    waitingInstitutions: result[10],

                    acceptedDrivers: result[11],
                    acceptedInstitutions: result[12],

                    rejectedDrivers: result[13],
                    rejectedInstitutions: result[14],

                    orders: result[15],
                    ordersTraderNotResponse:result[16],
                    ordersTraderResponse:result[17],
                    ordersNotAssign:[18]
                });
        } catch (err) {
            next(err);
        }

    },

    async getSharesCount(req, res, next) {
        try {
            let appleData = await getAppleData();
            let andriodData = await getAndroidData();
            res.send({
                appleData: appleData,
                andriodData: andriodData
            })
        } catch (error) {
            next(error);
        }
    },

    async graph(req, res, next) {
        try {
            let { year } = req.query;
            let currentYear = new Date();
            let ordersGraph = [];
            let query = { deleted: false, status: "DELIVERED" };
            let nextMonth = 11;

            if (!year) {
                year = currentYear.getFullYear();
                //nextMonth = currentYear.getMonth()
            }
            let startOfMonth, endOfMonth;
            for (let month = 0; month <= nextMonth; month++) {
                startOfMonth = moment([year, month]).startOf('month')
                endOfMonth = moment([year, month]).endOf('month')
                query.createdAt = { $gte: new Date(startOfMonth), $lt: new Date(endOfMonth) };
                let aggregateQuery = [
                    { $match: query },
                    { $group:{
                        _id: null,
                       total: { $sum: "$totalPrice" }}
                    }
                    
                ];
                let orderGraph =createPromise(await Order.aggregate(aggregateQuery));
                ordersGraph.push(orderGraph)

            }
            let resultGraph = await Promise.all(ordersGraph);
            let result =[];
            for (let index = 0; index < resultGraph.length; index++) {
                if(resultGraph[index].length > 0) result.push(resultGraph[index][0].total)
                else result.push(0)
            }

            res.status(200).send(result);
        } catch (err) {
            next(err);
        }

    },

}