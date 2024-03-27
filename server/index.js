import express, { response } from "express";
import mysql from "mysql2";
import cors from "cors";
import bcrypt from "bcrypt"
import bodyParser from "body-parser";
import session from "express-session";
import cookieParser from "cookie-parser";


const app = express();

const saltRounds = 10

app.use(express.json());
app.use(cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
}));

app.use(cookieParser())
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    key: "UserID",
    secret: "subscribe",
    resave: false,
    saveUninitialized: false,
    cookie:{
        expires: 60*60*24,
    }
}))


const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "123456",
    database: "webgaleri"
})


app.get("/", (req, res)=>{
    res.json("Hello you are entering the client server")
}), 



app.post("/users/register", (req, res) => { 
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;

    

    bcrypt.hash(password, saltRounds, (err, hash)=>{
        if(err){
            console.log(err)
        }
        db.query(
          "INSERT INTO user (`Username`,`Email`,`Password`) VALUES (?,?,?)",
             [username, email, hash],
            (err, result) => {
            console.log(err);
        })
    })
   
}),

app.get("/users/login", (req, res)=>{
    if(req.session.user){
        res.send({loggedIn:true, user: req.session.user});
    } else{
        res.send({loggedIn: false})
    }
})

app.post("/users/login", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    
    console.log("Received login request for username:", username);
    console.log("This is the pass that i input:", password);

    db.query(
       "SELECT * FROM user WHERE Username = ?",
       [username],
       (err, result) => {
            if(err){
        
               res.send({ err: err });
            } else {
            
                if (result.length > 0){
                  
                    bcrypt.compare(password, result[0].Password, 
                        (error, response)=>{
                          
                        if (response){
                            req.session.user = result,
                            console.log(req.session.user)

                            res.send(result);

                        } else {
                            res.send({ message: "Wrong username/password combination!" });
                        }
                    });
                } else {
                    console.log("User not found for username:", username);
                    res.send({ message: "User doesn't exist" });
                }
            }
       }
    );
});



app.listen(8800, ()=>{
    console.log("You are connected to the server 8800!")
})