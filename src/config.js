const config = {};
// config.mongoUrl = 'mongodb://ajam:ajam2021@cluster0-shard-00-00.4csul.mongodb.net:27017,cluster0-shard-00-01.4csul.mongodb.net:27017,cluster0-shard-00-02.4csul.mongodb.net:27017/ajam?ssl=true&replicaSet=atlas-3wwdb8-shard-0&authSource=admin&w=majority';
//config.mongoUrl = 'mongodb://admin:admin@cluster0-shard-00-00.tdw9d.mongodb.net:27017,cluster0-shard-00-01.tdw9d.mongodb.net:27017,cluster0-shard-00-02.tdw9d.mongodb.net:27017/Ajam?ssl=true&replicaSet=atlas-q9wxqg-shard-0&authSource=admin&w=majority'
config.mongoUrl = 'mongodb://admin:admin@cluster0-shard-00-00.rtubq.mongodb.net:27017,cluster0-shard-00-01.rtubq.mongodb.net:27017,cluster0-shard-00-02.rtubq.mongodb.net:27017/Hr?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin&retryWrites=true&w=majority';
//  config.mongoUrl = 'mongodb://127.0.0.1:27017/ajam'

config.jwtSecret = 'Hr-Features';
config.confirmMessage = 'verify code: ';
config.App = {Name:'Hr-Features'}
// config.GoogleApiKey = 'AIzaSyBFJpu6GVFQrjbVOfaZLXcdLO1-A8GQae0';
// config.twilioAccountSID = 'AC34189f894302e23d3911b811cd33e3b2';
// config.twilioAuthToken = '78596a652f83ccaa89996ad7b44c037e';
// config.twilioServiceSID = 'VA366c058a3677e33792b5d7d4871f8e5d';
// config.backend_endpoint = 'https://www.ajamadmin.com/Ajam-Backend';


config.notificationTitle = {
    ar:'Hr',
    en: 'Hr'
}


export default config;