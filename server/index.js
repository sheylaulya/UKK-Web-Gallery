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


// // Apply Middleware
// app.use(['/home', '/profile', '/posts/:id', '/add-post'], verifyUser);


// Login
const verifyUser = (req, res, next) => {

    const token = req.headers['authorization']

    console.log(token)
    if (!token) {
        return res.json({
            message: "We need to provide token!!!!!!!!!!"
        }, )
    } else {
        jwt.verify(token, "our-jsonwebtoken-secret-key", (err, decoded) => {
            if (err) {
                return res.json({
                    message: "authentication error!!!!!!!!"
                })
            } else {
                req.name = decoded.name;
                req.fullName = decoded.fullName;
                req.id = decoded.id;
                next();
            }

        })
    }
}

app.get("/", verifyUser, (req, res) => {
            return res.json({
                status: 'success',
                name: req.name,
                fullName: req.fullName,
                id: req.id
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
                    const fullName = user.NamaLengkap
                    const lokasi = user.Alamat
                    const id = user.UserID

                    const token = jwt.sign({
                        name,
                        fullName,
                        lokasi,
                        id
                    }, "our-jsonwebtoken-secret-key", {
                        expiresIn: '1d'
                    });

                    console.log(id)
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

// Logout
app.post("/users/logout", (req, res) => {
    res.clearCookie('token');
    return res.json({
        message: "Logout berhasil"
    });
});

// End Logout

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
    const DeskripsiFoto = req.body.DeskripsiFoto;
    const userID = req.body.userID;
    const TanggalUp = new Date(); // Membuat objek Date dari timestamp sekarang


    const formattedDate = TanggalUp.toISOString().slice(0, 19).replace('T', ' '); // Format tanggal ke dalam string ISO



    const q = "INSERT INTO foto (`JudulFoto`,`LokasiFile`,`DeskripsiFoto`,`TanggalUnggah`, `UserID`) VALUES (?,?,?,?,?)";
    db.query(q, [JudulFoto, LokasiFile, DeskripsiFoto, formattedDate, userID], (err, result) => {
        if (err) {

            console.error(err);
            return res.json({
                message: "error bang"
            });
        }
        return res.json({
            status: 'success'
        });
    });


})

app.get('/home', (req, res) => {
    const q = "SELECT f.*, u.Username FROM foto f LEFT JOIN user u ON u.UserID = f.UserID"
    db.query(q, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})


app.get('/posts/:id', (req, res) => {
    const FotoID = req.params.id;
    const q = `
    SELECT f.*, u.Username, u.NamaLengkap 
    FROM foto f 
    LEFT JOIN user u ON u.UserID = f.UserID 
    WHERE f.FotoID = ?
`;

    db.query(q, [FotoID], (err, data) => {
        if (err) return res.json(err);
        return res.json(data)
    })
    // console.log(values)
})
app.delete("/posts/delete/:id", (req, res) => {
    const id = req.params.id;
    const qDeleteLike = "DELETE FROM likefoto WHERE FotoID = ?";
    const qDeleteFoto = "DELETE FROM foto WHERE FotoID = ?";

    db.query(qDeleteLike, [id], (err, likeData) => {
        if (err) {
            console.error(err);
            return res.status(500).json(err);
        }
        
        // Jika penghapusan dari likefoto berhasil, lanjutkan dengan menghapus dari tabel foto
        db.query(qDeleteFoto, [id], (err, fotoData) => {
            if (err) {
                console.error(err);
                return res.status(500).json(err);
            }
            return res.json("Done delete bang");
        });
    });
});

// End CRUD Posts

// Start CRUD Likes

// GET request to get total like count for a photo
app.get('/likes/:FotoID', (req, res) => {
    const FotoID = req.params.FotoID;
    const userId = req.query.userId;

    console.log("User ID: ", userId);
    getLikeCount(FotoID, userId, res);
    // getLike(FotoID, userId, res);
});

function getLikeCount(FotoID, userId, res) {
    const qCount = "SELECT COUNT(*) AS likeCount FROM likefoto WHERE FotoID = ?";
    const qLiked = "SELECT * FROM likefoto WHERE FotoID = ? AND UserID = ?";

    db.query(qCount, [FotoID], (err, countResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Error fetching like count"
            });
        }

        db.query(qLiked, [FotoID, userId], (err, likedResult) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    message: "Error fetching like status"
                });
            }

            const likeCount = countResult[0].likeCount;
            const liked = likedResult.length > 0;

            return res.json({
                likeCount: likeCount,
                liked: liked
            });
        });
    });
}



// POST request to like a photo
app.post('/like/:FotoID', (req, res) => {
    const FotoID = req.params.FotoID;
    const UserID = req.body.userId; // Retrieve UserID from request body

    const TanggalLike = new Date(); // Creating a Date object from the current timestamp

    // Insert into likefoto table
    const q = "INSERT INTO likefoto (FotoID, UserID, TanggalLike) VALUES (?, ?, ?)";
    db.query(q, [FotoID, UserID, TanggalLike], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Error liking photo"
            });
        }
        // Return updated like count for the photo by the user
        getLikeCount(FotoID, UserID, res);
    });
});


// DELETE request to unlike a photo
app.post('/unlike/:FotoID', (req, res) => {
    const FotoID = req.params.FotoID;
    const UserID = req.body.userId;

    const q = "DELETE FROM likefoto WHERE FotoID = ? AND UserID = ?"
    db.query(q, [FotoID, UserID], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Error unliking photo"
            });
        }
        // Return updated like count
        getLikeCount(FotoID, UserID, res);
    });
    // res.status(200).json({
    //     LikeID: LikeID
    // });
    // });
});




app.listen(8800, () => {
    console.log("You are connected to the server 8800!")
})