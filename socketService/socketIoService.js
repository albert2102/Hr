import NotificationController from '../src/controllers/notif.controller/notif.controller';
import User from '../src/models/user.model/user.model'
import socketEvents from '../src/socketEvents'



module.exports = {

     startNotification: function (io) {
    //     global.notificationNSP = io.of('/utils');
    //     notificationNSP.on('connection', async function (socket) {
    //         var id = socket.handshake.query.id;
    //         let user = await User.findById(id);
    //         user = await User.populate(user,populateQuery);
    //         let company = await Company.findOne({ deleted: false });
    //         if (user) {
    //             var roomName = 'room-' + id;
    //             socket.join(roomName);
    //             console.log('clientttttttt ' + id + ' connected on notification.');
    //             notificationNSP.to(roomName).emit(socketEvents.NewUser, { user: user });
    //             notificationNSP.to(roomName).emit(socketEvents.Company, { company: company });
    //             await NotificationController.getCountNotification(id);
    //             if (user.type == 'INSTITUTION') await orderController.traderOrdersCount(id);
    //             if (user.type == 'DRIVER') {
    //                 console.log("in iffffffffffffffffffffffffffffff ",id)
    //                 await orderController.driverOrdersCount(id);
    //                 let waitingOrder = await Order.findOne({ deleted: false, driver: +id, status: 'ACCEPTED' ,orderType: 'DELIVERY'});
    //                 if (waitingOrder) {
    //                     waitingOrder = await Order.populate(waitingOrder, orderPopulateQuery)
    //                     notificationNSP.to('room-' + id).emit(socketEvents.NewOrder, { order: waitingOrder });
    //                 }
    //             }
    //         } else {
    //             notificationNSP.emit(socketEvents.Company, { company: company });
    //         }

    //     })
     },

    chat: function (io) {
    //     global.chatNSP = io.of('/chat');
    //     chatNSP.on('connection', async function (socket) {
    //         let id = socket.handshake.query.id;
    //         let roomName = 'room-admin';
    //         let user = await User.findById(id);
	//     socket.join(roomName);
    //         if (user) roomName = 'room-' + id;
    //         if (user) {
    //             socket.join(roomName);
    //             console.log('New User Connected ' + id + ' on chat ');
    //             await messageController.countUnseen(id)
    //             socket.on(socketEvents.Typing, async function (data) {
    //                 // data =  { to }
    //                 if (data.to) {
    //                     chatNSP.to('room-' + data.to).emit(socketEvents.Typing, { user: user });
    //                 } else {
    //                     chatNSP.to('room-admin').emit(socketEvents.Typing, { user: user });
    //                 }
    //             })
    //             socket.on(socketEvents.StopTyping, async function (data) {
    //                 // data =  { to }
    //                 if (data.to) {
    //                     chatNSP.to('room-' + data.to).emit(socketEvents.Typing, { user: user });
    //                 } else {
    //                     chatNSP.to('room-admin').emit(socketEvents.Typing, { user: user });
    //                 }
    //             })
    //             socket.on(socketEvents.UpdateSeen, async function (data) {
    //                 console.log('update seeeeeen ')
    //                 await messageController.updateSeen(id);
    //             })
    //         }
    //     })
     },

     admin: function (io) {
    //     global.adminNSP = io.of('/admin');
    //     adminNSP.on('connection', async function (socket) {
    //         var id = socket.handshake.query.id;
    //         let user = await User.findById(id);
    //         var roomName = 'room-admin';
    //         socket.join(roomName);
    //         if (user.type == 'SUB_ADMIN') {
    //             socket.join('room-' + id);
    //             adminNSP.to('room-' + id).emit(socketEvents.NewUser, { user, user });
    //         }
    //         console.log('New admin Connected ' + id + ' on admin nsp ');
    //         await NotificationController.getCountNotification(id, true);
    //         await messageController.countUnseenForAdmin();
    //         await messageController.countUnseenSupportChatForAdmin();
    //         await contactUsController.countNotReplied();
    //         await advertismentController.countNew();
    //         await issueController.countNew();
    //         await adminController.count('INSTITUTION');
    //         await adminController.count('DRIVER');
    //         await requestMoneyHistoryController.countNew();
    //         await orderController.TraderNotResponseCount();
    //         await orderController.DriverNotResponseCount();
    //     })
     },

     startTracking: function (io) {

    //     global.trackingNSP = io.of('/track');
    //     trackingNSP.on('connection', async function (socket) {
    //         var id = socket.handshake.query.id;
    //         let user = await User.findById(id)
    //         if (user) {
    //             var roomName = 'room-' + id;
    //             socket.join(roomName);
    //             console.log('clientttttttt ' + id + ' connected on tracking.');
    //             socket.on(socketEvents.NewLocation, async function (data) {
    //                 if (data && data.long && data.lat) {
    //                     let newLoc = { type: 'Point', coordinates: [data.long, data.lat] };
    //                     await User.findByIdAndUpdate(id, { $set: { geoLocation: newLoc } });
    //                     if (data.order) {
    //                         let order = await orderModel.findById(data.order).populate([{ path: 'driver', model: 'user' }]);
    //                         if (order) {
    //                             if (order.driver) {
    //                                 trackingNSP.to('room-' + order.user).emit(socketEvents.NewLocation, { order: order });
    //                                 trackingNSP.to('room-' + order.trader).emit(socketEvents.NewLocation, { order: order });

    //                             }
    //                         }
    //                     }
    //                 }
    //             })
    //         }
    //     })
     }
    
}