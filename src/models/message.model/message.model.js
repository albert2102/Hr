var mongoose = require('mongoose');
var mongoose_auto_increment = require('mongoose-auto-increment');
var Schema = mongoose.Schema;

var message = {
    _id: {
        type: Number,
        required: true
    },
    sender: {
        type: Number,
        ref: 'user'
    },
    reciver: { 
        user: { type: Number, ref: 'user' },
        delivered: { type: Boolean, default: false },
        deliverDate: { type: Date },
        read: { type: Boolean, default: false },
        readDate: { type: Date },
        deleted:{ type: Boolean, default: false }
    },
    message: {
        text: { type: String },
        image: { type: String },
        video: { type: String },
        document: { type: String },
        audio: { type: String },
        location: { lat: { type: String }, long: { type: String } }
    },
    playedBy: [Number],
    lastMessage:{
        type:Boolean,
        default:true
    },
    messageType:{
        type:String,
        enum:['NORMAL','SUPPORT'],
        default:'NORMAL'
    },
    //////////////////////////////////////////////////////////////
    activeChatHead: {
        type: Number,
        ref: 'user'
    },
    deleted: {
        type: Boolean,
        default: 0
    },
    complaint:{
        type: Number,
        ref:'complaint'
    },
    order:{
        type: Number,
        ref:'order'
    }
}

var messageSchema = new Schema(message, { timestamps: true });
messageSchema.set('toJSON', {
    transform: function (doc, ret, options) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});
mongoose_auto_increment.initialize(mongoose.connection);
messageSchema.plugin(mongoose_auto_increment.plugin, { model: 'message', startAt: 1 });
var messageModel = mongoose.model('message', messageSchema);
export default messageModel;