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
app.use(bodyParser.urlencoded({
    extended: true
}));

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

app.get("/", (req, res) => {
        res.json("Hello you are entering the client server")
    }),

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

    }),

    app.get("/users/login", (req, res) => {
        if (req.session.user) {
            res.send({
                loggedIn: true,
                user: req.session.user
            });
        } else {
            res.send({
                loggedIn: false
            })
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
            if (err) {

                res.send({
                    err: err
                });
            } else {

                if (result.length > 0) {

                    bcrypt.compare(password, result[0].Password,
                        (error, response) => {

                            if (response) {
                                req.session.user = result,

                                    res.send(result);

                            } else {
                                res.send({
                                    message: "Wrong username/password combination!"
                                });
                            }
                        });
                } else {
                    console.log("User not found for username:", username);
                    res.send({
                        message: "User doesn't exist"
                    });
                }
            }
        }
    );
});


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
    
    db.query(q, [FotoID], (err,data)=>{
        if(err) return res.json(err);
        return res.json(data)
    })
    // console.log(values)
})

app.delete("/posts/delete/:id", (req,res)=>{
    const id = req.params.id;
    const q = "DELETE FROM foto WHERE FotoID = ?"

    db.query(q,[id], (err,data)=>{
        if(err) return res.json(err);
        return res.json("Done delete bang")
    })
})




app.listen(8800, () => {
    console.log("You are connected to the server 8800!")
})