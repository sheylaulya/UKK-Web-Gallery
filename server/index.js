import express, {
    response
} from "express";
import mysql from "mysql2";
import cors from "cors";
import bcrypt from "bcrypt"
import bodyParser from "body-parser";
import session from "express-session";
import cookieParser from "cookie-parser";
import multer from "multer";
import path from "path"
import jwt from "jsonwebtoken"
import {
    verify
} from "crypto";
import {
    decode
} from "punycode";

const app = express();

const saltRounds = 10

app.use(express.json());

app.use(express.static('public'))



app.use(cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "DELETE"],
    credentials: true
}));

app.use(cookieParser())
// app.use(bodyParser.urlencoded({
//     extended: true
// }));

app.use(session({
    key: "UserID",
    secret: "subscribe",
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 60 * 60 * 24,
    }
}))


const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "123456",
    database: "webgaleri"
})



// Regist
app.post("/users/register", (req, res) => {
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;



    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
            console.log(err)
        }
        db.query(
            "INSERT INTO user (`Username`,`Email`,`Password`) VALUES (?,?,?)",
            [username, email, hash],
            (err, result) => {
                console.log(err);
            })
    })

})
// End Regist


// Login

const verifyUser = (req, res, next) => { 
   
    const token = req.headers['Authorization'] 
 
    console.log(token) 
    if (!token) { 
        return res.json({ 
            message: "We need to provide token!!!!!!!!!!" 
        }) 
    } else { 
        jwt.verify(token, "our-jsonwebtoken-secret-key", (err, decoded) => { 
            if (err) { 
                return res.json({ 
                    message: "authentication error!!!!!!!!" 
                }) 
            } else { 
                req.name = decoded.name; 
                next(); 
            } 
        }) 
    } 
}


app.get("/", verifyUser, (req, res) => {
        return res.json({
            status: 'success',
            name: req.name
        })
    }
    
    ),


    app.post("/users/login", (req, res) => {  
        const q = "SELECT * FROM user WHERE Username = ?";  
        db.query(q, [req.body.Username], async (err, data) => {  
            if (err) return res.json({  
                message: "Error"  
            });  
      
            if (data.length > 0) {  
                const user = data[0];  
                const match = await bcrypt.compare(req.body.Password, user.Password);  
                if (match) {  
                    const name = user.Username;  
                    const token = jwt.sign({  
                        name  
                    }, "our-jsonwebtoken-secret-key", {  
                        expiresIn: '1d'  
                    });  
                    // ini yang gua rubah 
                    // res.cookie('token', token);  
     
                    // jadi kalo login nya berhasil lu kirim token nya ke react 
                    return res.json({  
                        token, // ini yang gua rubah 
                        status: "success",  
                    });  
      
                } else {  
                    return res.json({  
                        message: "Invalid Username or Password"  
                    });  
                }  
            } else {  
                return res.json({  
                    message: "No Records Existed"  
                });  
            }  
              
        });  
    });
// End Login

// CRUD POSTS
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
    }
})

const upload = multer({
    storage: storage
})

app.post('/upload', upload.single('LokasiFile'), (req, res) => {
    const LokasiFile = req.file.filename;
    const JudulFoto = req.body.JudulFoto
    const DeskripsiFoto = req.body.DeskripsiFoto

    const q = "INSERT INTO foto (`JudulFoto`,`LokasiFile`,`DeskripsiFoto`) VALUES (?,?,?)"

    db.query(q, [JudulFoto, LokasiFile, DeskripsiFoto], (err, result) => {
        if (err) return res.json({
            message: "error bang"
        })
        return res.json({
            status: 'success'
        })
    })
})

app.get('/home', (req, res) => {
    const q = "SELECT * FROM foto"
    db.query(q, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})


app.get('/posts/:id', (req, res) => {
    const FotoID = req.params.id;
    const q = 'SELECT * FROM foto WHERE FotoID = ?'

    db.query(q, [FotoID], (err, data) => {
        if (err) return res.json(err);
        return res.json(data)
    })
    // console.log(values)
})

app.delete("/posts/delete/:id", (req, res) => {
    const id = req.params.id;
    const q = "DELETE FROM foto WHERE FotoID = ?"

    db.query(q, [id], (err, data) => {
        if (err) return res.json(err);
        return res.json("Done delete bang")
    })
})
// End CRUD Posts



app.listen(8800, () => {
    console.log("You are connected to the server 8800!")
})