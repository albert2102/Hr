import User from "../../models/user.model/user.model";
import Order from "../../models/order.model/order.model";
import Product from "../../models/product.model/product.model";
import Category from "../../models/category.model/category.model";
import TradeMark from "../../models/tradeMark.model/tradeMark.model";

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

let getProducts = async (list) => {
    try {
        let promises = [];
        let result = [];
        for (let index = 0; index < list.length; index++) {
            let aggregateQuery = [{ $match: { deleted: false, 'products.product': +list[index], status: 'DELIVERED' } },
            { $group: { _id: { product: '$products' } } },
            { $unwind: '$_id.product' },
            { $match: { '_id.product.product': +list[index] } },
            { $group: { _id: "$_id.product.product", totalQuantity: { $sum: "$_id.product.quantity" }, totalPrice: { $sum: { $multiply: ["$_id.product.quantity", "$_id.product.priceAfterOffer"] } } } },
            {
                $lookup: {
                    from: Product.collection.name,
                    localField: "_id",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: '$product' },

            {
                $lookup: {
                    "from": TradeMark.collection.name,
                    "localField": "product.tradeMark",
                    "foreignField": "_id",
                    "as": "product.tradeMark"
                }
            },
            { $unwind: "$product.tradeMark" },
            { $sort: { "totalQuantity": -1 } },

            ]
           
            promises.push(createPromise(Order.aggregate(aggregateQuery)));
        }
        let finalResult = await Promise.all(promises);
        for (let index = 0; index < finalResult.length; index++) {
            if (finalResult[index].length > 0) {
                delete finalResult[index][0]._id;
                result.push(finalResult[index][0])
            }
        }

        return result;
    } catch (error) {
        throw error;
    }

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

    async getLastOrders(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 10;

            let lastOrders = await Order.find({ deleted: false })
                .sort({ createdAt: -1 })
                .limit(limit).skip((page - 1) * limit)
                .populate([{ path: 'user', model: 'user' }, { path: 'products.product', model: 'product' }])

            lastOrders = Order.schema.methods.toJSONLocalizedOnly(lastOrders, i18n.getLocale());

            res.send(lastOrders);
        } catch (error) {
            next(error);
        }
    },

    async topOrders(req, res, next) {
        try {
            let page = +req.query.page || 1, limit = +req.query.limit || 10;

            let lastOrders = await Order.find({ deleted: false, status: 'DELIVERED' })
                .sort({ totalPrice: -1 })
                .limit(limit).skip((page - 1) * limit)
                .populate([{ path: 'user', model: 'user' }, { path: 'products.product', model: 'product' }])

            lastOrders = Order.schema.methods.toJSONLocalizedOnly(lastOrders, i18n.getLocale());

            res.send(lastOrders);
        } catch (error) {
            next(error);
        }
    },

    async topSellingProduct(req, res, next) {
        try {
            let products = await Product.find({ deleted: false }).distinct('_id');
            let orders = await getProducts(products);
            res.send(orders);
        } catch (error) {
            next(error);
        }
    },

    async count(req, res, next) {
        try {

            //////////////////////////////////PARENTS/////////////////////////////////////////////////

            const users = createPromise(User.count({ deleted: false, type: 'CLIENT' }));
            const categories = createPromise(Category.count({ deleted: false }));
            const products = createPromise(Product.count({ deleted: false }));
            const orders = createPromise(Order.count({ deleted: false }));
            const ordersWaiting = createPromise(Order.count({ deleted: false, status: 'WAITING' }));
            const ordersAccepted = createPromise(Order.count({ deleted: false, status: 'ACCEPTED' }));
            const ordersRejected = createPromise(Order.count({ deleted: false, status: 'REJECTED' }));
            const ordersCanceled = createPromise(Order.count({ deleted: false, status: 'CANCELED' }));
            const ordersShipped = createPromise(Order.count({ deleted: false, status: 'SHIPPED' }));
            const ordersDelivered = createPromise(Order.count({ deleted: false, status: 'DELIVERED' }));


            let counts = [
                users, categories, products, orders,
                ordersWaiting, ordersAccepted, ordersRejected, ordersCanceled, ordersShipped, ordersDelivered
            ]
            let result = await Promise.all(counts);

            res.status(200).send(
                {
                    users: result[0],
                    categories: result[1],
                    products: result[2],
                    orders: result[3],
                    ordersWaiting: result[4],
                    ordersAccepted: result[5],
                    ordersRejected: result[6],
                    ordersCanceled: result[7],
                    ordersShipped: result[8],
                    ordersDelivered: result[9]
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