import nodemailer from 'nodemailer';
import config from '../config';
import handlebars from 'handlebars';
import fs from 'fs';

var readHTMLFile = function (path, callback) {
    fs.readFile(path, { encoding: 'utf-8' }, function (err, html) {
        if (err) {
            throw err;
            callback(err);
        }
        else {
            callback(null, html);
        }
    });
};

let transporter = nodemailer.createTransport({
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

    host: "smtp.office365.com",  
    secure: false,
    port: 587,
    auth: {
        user: "ajam@ajaminfo.com",
        pass: "Ajam20201.ajam"
    },
    tls: {
        rejectUnauthorized: false,
        ciphers:'SSLv3'
    },

});

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

export function sendHtmlEmail(targetMail,orderNumber,productSize,price,transportationPrice,Taxes,address,street,buildingNumber,flatNumber,totalPrice) {
    readHTMLFile(__dirname + '/order.html', function (err, html) {
        var template = handlebars.compile(html);
        template = template({
            orderNumber:orderNumber,
            productSize:productSize,
            price: price,
            transportationPrice:transportationPrice,
            Taxes: Taxes.toString(),
            address:address,
            street:street,
            buildingNumber:buildingNumber,
            flatNumber:flatNumber,
            totalPrice:totalPrice
        })
       
        let mailOptions = {
            from: 'ajam@ajaminfo.com',
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
    })
    return true;
}




export function sendChangeOrderEmail(targetMail,text) {
    readHTMLFile(__dirname + '/orderStatus.html', function (err, html) {
        var template = handlebars.compile(html);
        template = template({
            text:text
        })
       
        let mailOptions = {
            from: 'ajam@ajaminfo.com',
            to: targetMail,
            subject: `${config.App.Name}`,
            html: template
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            }
        });
    })
    return true;
}