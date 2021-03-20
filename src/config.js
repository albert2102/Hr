const config = {};
config.mongoUrl = 'mongodb://ajam:ajam2021@cluster0-shard-00-00.4csul.mongodb.net:27017,cluster0-shard-00-01.4csul.mongodb.net:27017,cluster0-shard-00-02.4csul.mongodb.net:27017/ajam?ssl=true&replicaSet=atlas-3wwdb8-shard-0&authSource=admin&w=majority';
// config.mongoUrl = 'mongodb://127.0.0.1:27017/ajam'
config.jwtSecret = 'Ajam';
config.confirmMessage = 'verify code: ';
config.App = {Name:'Ajam'}
config.GoogleApiKey = 'AIzaSyAopqrgTVP86bnQposmo5dYB3jidriBvJM';
config.twilioAccountSID = 'AC34189f894302e23d3911b811cd33e3b2';
config.twilioAuthToken = '78596a652f83ccaa89996ad7b44c037e';
config.twilioServiceSID = 'VA366c058a3677e33792b5d7d4871f8e5d';
config.backend_endpoint = 'https://www.catchit.sa/Catchit-Backend';


config.notificationTitle = {
    ar:'أجَمْ',
    en: 'Ajam'
}

config.payment = {
    //////////////////////////test////////////////////////////////
    // access_token : 'Bearer OGFjN2E0Yzk3NzJiNThhNjAxNzczODUyMWExZTBmMjV8NVlBRnA0V0dteg==',
    // Entity_ID_Card: '8ac7a4c9772b58a60177385297290f2a',
    // Entity_ID_Mada: '8ac7a4c9772b58a601773852f9a70f2e',
    // host: 'test.oppwa.com',
    /////////////////////////live////////////////////////////////
    access_token : 'Bearer OGFjZGE0Yzg3N2Q0YTA4MzAxNzdkOGFhYWQ1ODIzMzN8Q1NmM3dCRGVCOQ==',
    Entity_ID_Card: '8acda4c877d4a0830177d8abc15f233e',
    Entity_ID_Mada: '8acda4c877d4a0830177d8ad3d4b2355',
    host: 'oppwa.com' ,
    Currency: 'SAR',
    PaymentType: 'DB',
    testMode:'EXTERNAL',
    notificationUrl : 'https://www.catchit.sa/Catchit-Backend/payment/notify',
}


/////////////twilio///////////////////
////email == ajamapplication55@gmail.com
/// pass === ajamapplication55
export default config;