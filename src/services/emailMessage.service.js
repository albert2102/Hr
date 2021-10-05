import nodemailer from 'nodemailer';
import config from '../config';
import handlebars from 'handlebars';
import fs from 'fs';

handlebars.registerHelper('concat', function(path) {
    return config.domain + path;
});

let transporterConfig = {
    // pool: true,
    // host: 'smtp.gmail.com',
    // port: 465,
    // secure: true, 
    // auth: {
    //     user: 'ajamapp2021@gmail.com',
    //     pass: 'Tech4life'
    // },
    // tls: {
    //     rejectUnauthorized: false
    // }
    /////////////////////////////////////////////
    // tls: {
    //     rejectUnauthorized: false
    // },

    // host: 'smtp.office365.com',
    // port: 587,
    // secure: false, // true for 465, false for other ports
    // auth: {
    //   user: 'ajam@ajaminfo.com', // your domain email address
    //   pass: 'Ajam20201.ajam' // your password
    // }

    host: "smtpout.secureserver.net",  
    secure: true,
    port: 465,
    auth: {
        user: "ajam@ajaminfo.com",
        pass: "Ajam20201.ajam"
    },
    tls: {
        rejectUnauthorized: false,
        ciphers:'SSLv3'
    },

}

let transporter = nodemailer.createTransport(transporterConfig);

export function sendEmail(targetMail, text) {

    let mailOptions = {
        from: 'ajam@ajaminfo.com',
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

export function sendHtmlEmail(targetMail, templateName, params) {
    try {
        params.domain = config.backend_endpoint;
        let html = fs.readFileSync(__dirname + `/../emails/${templateName}`, { encoding: 'utf8' });
        var template = handlebars.compile(html);
        console.log(params);
        template = template({ ...params });

        let mailOptions = {
            from: transporterConfig.auth.user,
            to: targetMail,
            subject: `${config.App.Name}`,
            html: template,
            // attachments: [{
            //     filename: '1.png',
            //     path:  "../../1.png",
            //     cid: 'unique@kreata.ee'
            //   }],
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            }
        });

        return true;
    } catch (error) {
        throw error;
    }
}