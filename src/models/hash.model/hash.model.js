var mongoose = require('mongoose');
var auto_increment = require('mongoose-auto-increment');
var Schema = mongoose.Schema ;

var hash = {
    _id : {
        type : Number , 
        required : true
    },
    token : {
        type : String , 
        required : true , 
    },
    user:{
        type : Number , 
        required : true ,
        ref : 'user'
    },
    deleted : {
        type:Boolean , 
        default : false 
    }
}
var hash_Schema = new Schema(hash , { timestamps: true });
hash_Schema.set('toJSON',{
    transform: function (doc, ret, options){
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

auto_increment.initialize(mongoose.connection);
hash_Schema.plugin(auto_increment.plugin , {model:'hash' , startAt: 1}) ;
export default mongoose.model('hash', hash_Schema);