const mysql = require('mysql2');

const db = mysql.createConnection({
    host:'localhost',
    user:'root',
    password:'',
    database:'learn'

});

db.connect((err)=>{
    if(err){
        return err.status(500).json({message : 'Failed to connect to the database'});
    }
    console.log('database connected succesful');
})

module.exports = db;