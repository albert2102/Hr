import NotificationController from '../src/controllers/notif.controller/notif.controller';
import messageController from '../src/controllers/message.controller/message.controller';
import User from '../src/models/user.model/user.model'
import socketEvents from '../src/socketEvents'
import contactUsController from '../src/controllers/contactUs.controller/contactUs.controller'
import Company from '../src/models/company.model/company.model'
import advertismentController from '../src/controllers/advertisments.controller/advertisments.controller';
import issueController from "../src/controllers/issue.controller/issue.controller";

module.exports = {

    startNotification: function(io) {
        global.notificationNSP = io.of('/utils');
        notificationNSP.on('connection', async function(socket) {
            var id = socket.handshake.query.id;
            let user = await User.findById(id);
            let company = await Company.findOne({ deleted: false });
            if (user) {
                var roomName = 'room-' + id;
                socket.join(roomName);
                console.log('clientttttttt ' + id + ' connected on notification.');
                notificationNSP.to(roomName).emit(socketEvents.NewUser, { user: user });
                notificationNSP.to(roomName).emit(socketEvents.Company, { company: company });
                await NotificationController.getCountNotification(id);
            } else {
                notificationNSP.emit(socketEvents.Company, { company: company });
            }

        })
    },

    chat: function(io) {
        global.chatNSP = io.of('/chat');
        chatNSP.on('connection', async function(socket) {
            let id = socket.handshake.query.id;
            let roomName = 'room-admin';
            let user = await User.findById(id);
            if(user && (user.type == 'CLIENT')) roomName = 'room-' + id;
            if (user) {
                socket.join(roomName);
                console.log('New User Connected ' + id + ' on chat ');
                await messageController.countUnseen(id)
                socket.on(socketEvents.Typing, async function(data) {
                    // data =  { to }
                    if (data.to) {
                        chatNSP.to('room-' + data.to).emit(socketEvents.Typing, { user: user });
                    }else{
                        chatNSP.to('room-admin').emit(socketEvents.Typing, { user: user });
                    }
                })
                socket.on(socketEvents.StopTyping, async function(data) {
                    // data =  { to }
                    if (data.to) {
                        chatNSP.to('room-' + data.to).emit(socketEvents.Typing, { user: user });
                    }else{
                        chatNSP.to('room-admin').emit(socketEvents.Typing, { user: user });
                    }
                })
                socket.on(socketEvents.UpdateSeen, async function(data) {
                	console.log('update seeeeeen ')
                    await messageController.updateSeen(id);
                })
            }
        })
    },

    admin: function(io) {
        global.adminNSP = io.of('/admin');
        adminNSP.on('connection', async function(socket) {
            var id = socket.handshake.query.id;
            let user = await User.findById(id);
            var roomName = 'room-admin';
            socket.join(roomName);
            if(user.type == 'SUB_ADMIN'){
                socket.join('room-'+ id);
                adminNSP.to('room-'+ id).emit(socketEvents.NewUser, {user, user });
            }
            console.log('New admin Connected ' + id + ' on admin nsp ');
            await NotificationController.getCountNotification(id, true);
            await messageController.countUnseenForAdmin();
            await contactUsController.countNotReplied();
            await advertismentController.countNew();
            await issueController.countNew();
        })
    },

}