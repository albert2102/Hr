import nodemailer from 'nodemailer';
import config  from '../config'
let transporter = nodemailer.createTransport({
    pool: true,
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, 
    auth: {
        user: 'catchitapp2020@gmail.com',
        pass: 'Tech4life'
    },
    tls: {
        rejectUnauthorized: false
    }

});

export function sendEmail(targetMail, text) {

    let mailOptions = {
        from: `${config.App.Name}`,
        to: targetMail,
        subject: `${config.App.Name}`,
        text: text,

    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
             console.log(error);
        }
    });


    return true;
}