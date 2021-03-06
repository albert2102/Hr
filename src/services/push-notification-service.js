import * as admin from 'firebase-admin';

const serviceAccount = require('../../serviceAccount.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://fcm-tests-d7344.firebaseio.com'
});


export async function sendPushNotification(notifi) {

    try {
        
        for (let index = 0; index < notifi.targetUser.tokens.length; index++) {
		  console.log(notifi)
            var userToken = notifi.targetUser.tokens[index].token;
            if (notifi.targetUser.tokens[index].type == 'android') {
                var payload = { token: userToken};
                payload.data = {
                    title: notifi.title.toString(),
                    message: notifi.text,
                    subjectId: notifi.subjectId.toString(),
                    subjectType: notifi.subjectType,
                    priority: "max",
                    visibility: "public",
                    importance: "max",
                    soundName : 'alert',
                    sound : 'default',
                }
                payload.notification = {
                    title: notifi.title.toString(),
                    body: notifi.text,
                   

                }
                payload.android={
                    notification: {
                        click_action:"OPEN_ACTIVITY_1",
                    }}
                if(notifi.image && notifi.image != ''){
                    payload.data.image = notifi.image;
                    payload.data.badge = notifi.image;
                    payload.notification.image = notifi.image;
                }
                if(notifi.subjectType == 'ORDER') {
                    payload.data.soundName = 'alert';
                    payload.data.sound = 'alert';
		    //payload.notification.soundName = 'alert';
                    //payload.notification.sound = 'alert';
                }
                
                console.log(payload)
		//console.log(payload.data)
                admin.messaging().send(payload)
                    .then(response => {
                        console.log('Successfully sent a message');
                    })
                    .catch(error => {
                        console.log('Error sending a message:', error.message);
                    });
            } else {
                let payload = {
                    notification: {
                        title: notifi.title.toString(),
			            image: '',
                        body: notifi.text,
                        sound: 'default',
                        badge: '1'
                    },
                    data: {
                        message: notifi.text,
                        subjectId: notifi.subjectId.toString(),
                        subjectType: notifi.subjectType,
                    }
                };
                if(notifi.image && notifi.image != ''){
                    payload.data.image = notifi.image;
                    payload.data.badge = notifi.image;
                    payload.notification.image = notifi.image;
                }
                if(notifi.subjectType == 'ORDER') payload.notification.sound = 'alert';
		        console.log(payload)
		//console.log(payload.notification)

                admin.messaging().sendToDevice(userToken, payload)
                    .then(response => {
                        console.log('Successfully sent a message');
                    })
                    .catch(error => {
                        console.log('Error sending a message:', error);
                    });
            }
        }
    } catch (error) {
        console.log('fire base error -->  ', error.message);
    }
}

export async function sendPushNotificationToGuests(notifi) {
    var payload = {
        data: {
            message: notifi.text,
            subjectId: notifi.subjectId.toString(),
            subjectType: notifi.subjectType
        },
        token: notifi.targetUser
    }
    admin.messaging().send(payload)
        .then(response => {
            console.log('Successfully sent a message');
        })
        .catch(error => {
            console.log('Error sending a message:', error.message);
        });
}

export async function testDifferentPayLoad(payload) {
    let c = await User.find({ deleted: false });
    for (let index = 0; index < c.length; index++) {
        for (let i = 0; i < c[index].token.length; i++) {
            payload.token = c[index].token[i];
            admin.messaging().send(payload)
                .then(response => {
                    console.log('Successfully sent a message');
                })
                .catch(error => {
                    console.log('Error sending a message:', error.message);
                });

        }

    }

}