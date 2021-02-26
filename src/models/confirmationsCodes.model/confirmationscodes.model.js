var mongoose=require('mongoose');
var mongoose_auto_increment=require('mongoose-auto-increment');
var Schema=mongoose.Schema;

var code={
    _id:{
        type:Number,
        required:true
    },
    email:{
        type:String ,
        // required:true
    },
    phone:{
        type: String
    },
    code :{
        type:String ,
        // required:true 
    },
    type:{
        type: String,
        enum:['PASSWORD','EMAIL','PHONE'],
        default: 'PASSWORD'
    },
    verified:{
        type: Boolean,
        default: false
    }
}

var codeSchema=new Schema(code , {timestamps:true});
codeSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
mongoose_auto_increment.initialize(mongoose.connection);
codeSchema.plugin(mongoose_auto_increment.plugin , {model:'confirmationCode' , startAt:1} );
var codeModel = mongoose.model('confirmationCode',codeSchema);
export default codeModel ;