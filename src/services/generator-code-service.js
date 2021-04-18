import generator from 'password-generator';

export const generateVerifyCode = (lenght,regex) => {
    if (regex) {
        return generator(lenght,false,regex)
    }else{
        return generator(lenght,false,'^[0-9]*$')
    }
};
