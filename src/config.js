const config = {};
//config.mongoUrl = 'mongodb://ajam:ajam2021@cluster0-shard-00-00.4csul.mongodb.net:27017,cluster0-shard-00-01.4csul.mongodb.net:27017,cluster0-shard-00-02.4csul.mongodb.net:27017/ajam?ssl=true&replicaSet=atlas-3wwdb8-shard-0&authSource=admin&w=majority';
// config.mongoUrl = 'mongodb://admin:admin@cluster0-shard-00-00.tdw9d.mongodb.net:27017,cluster0-shard-00-01.tdw9d.mongodb.net:27017,cluster0-shard-00-02.tdw9d.mongodb.net:27017/Ajam?ssl=true&replicaSet=atlas-q9wxqg-shard-0&authSource=admin&w=majority'
config.mongoUrl = 'mongodb://127.0.0.1:27017/ajam'

config.jwtSecret = 'Ajam';
config.confirmMessage = 'verify code: ';
config.App = {Name:'Ajam'}
config.GoogleApiKey = 'AIzaSyBFJpu6GVFQrjbVOfaZLXcdLO1-A8GQae0';
config.twilioAccountSID = 'AC34189f894302e23d3911b811cd33e3b2';
config.twilioAuthToken = '78596a652f83ccaa89996ad7b44c037e';
config.twilioServiceSID = 'VA366c058a3677e33792b5d7d4871f8e5d';
config.backend_endpoint = 'https://www.ajamadmin.com/Ajam-Backend';


config.notificationTitle = {
    ar:'أجَمْ',
    en: 'Ajam'
}

config.payment = {
    //////////////////////////test////////////////////////////////
    access_token : 'Bearer OGFjN2E0Yzk3YWE1MTE0MTAxN2FhNTg4NTU5NzA0MGN8aHltQVhXNllBYQ==',
    Entity_ID_Card: '8ac7a4c97aa51141017aa58930950410',
    Entity_ID_Mada: '8ac7a4c97aa51141017aa589ebb90415',
    host: 'test.oppwa.com',
    /////////////////////////live////////////////////////////////
    // access_token : 'Bearer OGFjN2E0Yzk3YWE1MTE0MTAxN2FhNTg4NTU5NzA0MGN8aHltQVhXNllBYQ==',
    // Entity_ID_Card: '8ac7a4c97aa51141017aa58930950410',
    // Entity_ID_Mada: '8ac7a4c97aa51141017aa589ebb90415',
    // host: 'oppwa.com' ,
    /////////////////////////////////////////////////////////////
    Currency: 'SAR',
    PaymentType: 'DB',
    testMode:'EXTERNAL',
    notificationUrl : 'https://www.catchit.sa/Catchit-Backend/payment/notify',
}


/////////////twilio///////////////////
////email == ajamapplication55@gmail.com
/// pass === ajamapplication55
export default config;