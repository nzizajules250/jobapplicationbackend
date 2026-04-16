require('dotenv').config();
const express = require('express');
const db = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();

app.use(express.json());

const auth = (req, res, next) => {
    const authheader = req.headers['authorization'];
    const token = authheader && authheader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    jwt.verify(token, process.env.JWT_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        req.user = decoded; 
        next(); 
    });
};

const isAdmin = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        next();
    };
};

const useronly = (req , res, next)=>{
 const allowed = req.user.role;
 if(allowed !== 'user'){
    return res.status(403).json({message: 'Forbidden not allowed only users are allowed to access this endpiotn'})
 }
  next();

}
app.get('/all/user' , auth , useronly, (req , res)=>{ 
    const sql = 'select * from user';
    db.query(sql , (err , result)=>{
        if(err){
            return res.status(500).json({message : 'Failed to get users'});
        }
        res.json({message : 'Users fetched successfully' , result});
    })
})

app.post('/register' , async (req , res)=>{
    const {full_name ,email , phone_number ,location , role , password} = req.body;
    const hashpassword = await bcrypt.hash(password , 10);
    const sql = 'INSERT INTO user(full_name , email , phone_number , location , role , password) VALUES(?,?,?,?,?,?)';
    db.query(sql , [full_name , email , phone_number , location , role , hashpassword] , (err , result)=>{
        if(err){
            return console.log('Failed to register user' , err);
        }
        res.json({message : 'User registered successfully ' , result});
    })

})

app.get('/profile', auth, (req, res) => {
    res.json({
        message: "THIS IS YOUR DATA",
        user: req.user 
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM user WHERE email = ?';

    db.query(sql, [email], async (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'FAILED TO GET USER' });
        }

        const user = result[0];
        if (!user) {
            return res.status(404).json({ message: 'USER NOT FOUND' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(400).json({ message: 'INVALID PASSWORD' });
        }

        const token = jwt.sign(
            {
                user_id: user.uid, 
                name: user.full_name,
                email: user.email,
                location: user.location,
                role: user.role
            },
            process.env.JWT_KEY,
            { expiresIn: '1h' }
        );

        res.json({ message: 'LOGIN SUCCESSFUL', token });
    });
});

app.get('/all/job' , auth, isAdmin('admin'), (req , res)=>{
    const sql ='SELECT * FROM jobs';

    db.query(sql , (err , result)=>{
        if(err){
            return res.status(500).json({message : 'Failed to get jobs'});
        }
        res.json({message : 'Jobs fetched successfully' , result});
    });
})


app.post('/jobs', auth, (req, res) => {
    const { job_title, job_description, salary, location, status, company_name } = req.body;

    const userId = req.user.user_id; 

    const sql = `
        INSERT INTO jobs 
        (job_title, job_description, salary, location, status, company_name, user_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [job_title, job_description, salary, location, status, company_name, userId], (err, result) => {
        if (err) {
            console.log('Failed to post job', err);
            return res.status(500).json({ message: 'Error posting job' });
        }

        res.json({ message: 'Job posted successfully', result });
    });
});

app.put('/jobs/:id', auth, (req, res) => {
    const jobid = req.params.id;
    const { job_title, job_description, salary, location, status, company_name } = req.body;

    const userId = req.user.user_id;

    const sql = `
        UPDATE jobs 
        SET job_title = ?, job_description = ?, salary = ?, location = ?, status = ?, company_name = ? 
        WHERE job_id = ? AND user_id = ?
    `;

    db.query(
        sql,
        [job_title, job_description, salary, location, status, company_name, jobid, userId],
        (err, result) => {
            if (err) {
                console.log('Failed to update job', err);
                return res.status(500).json({ message: 'Error updating job' });
            }

            if (result.affectedRows === 0) {
                return res.status(403).json({
                    message: 'Not authorized or job not found'
                });
            }

            res.json({ message: 'Job updated successfully' });
        }
    );
});


app.get('/jobs', auth, (req, res) => {
    const userId = req.user.user_id; 

    const sql = 'SELECT * FROM jobs WHERE user_id = ?';

    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.log('Failed to get jobs', err);
            return res.status(500).json({ message: 'Error fetching jobs' });
        }

        res.json({
            message: 'Jobs fetched successfully',
            result
        });
    });
});


app.get('/all/apply',auth , isAdmin('admin'), (req , res)=>{ 
    const sql = ' SELECT a.*, j.job_title, u.full_name FROM applications a JOIN jobs j ON a.job_id = j.job_id JOIN user u ON a.user_id = u.uid';
    db.query(sql , (err , result)=>{
        if(err){
            console.log('Failed to get applications' , err);
            return res.status(500).json({message : 'Error fetching applications'});
        }
        res.json({message : 'Applications fetched successfully' , result});
    });
})


app.post('/apply',auth ,(req , res)=>{
    const{job_id , cover_letter , status} = req.body;
    const user_id = req.user.user_id; 
    const sql = 'INSERT INTO applications(job_id , user_id , cover_letter , status) VALUES(? , ? , ? ,?)';
    db.query(sql , [job_id , user_id , cover_letter , status] , (err , result)=>{
        if(err){
            console.log('Failed to apply for job' , err);
            return res.status(500).json({message : 'Error applying for job'});
        }
        res.json({message : 'Applied for job successfully' , result});
    });

})
app.listen(4500 , ()=>{
    console.log('server is running on port 4500');
})