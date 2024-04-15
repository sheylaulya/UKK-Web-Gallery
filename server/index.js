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
    methods: ["GET", "POST", "DELETE", "PUT"],
    credentials: true
}));

app.use(cookieParser())

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

// Image Storage
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
// Ends Image Storage



// helper
const selectData = (q, val) => {
    return new Promise((resolve, reject) => {
        db.query(q, val, (err, data) => {
            // console.log(data)
            if (err) {
                reject(err)
            } else {
                resolve(data)
            }
        })
    })
}


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

    const token = req.headers['authorization']

    // console.log(token)
    if (!token) {
        return res.json({
            message: "We need to provide token!!!!!!!!!!"
        }, )
    } else {
        // proses pengecekan token
        jwt.verify(token, "our-jsonwebtoken-secret-key", (err, decoded) => {
            if (err) {
                // jika error
                return res.json({
                    message: "authentication error!!!!!!!!"
                })
            } else {
                // jika token cocok

                // memasukan data user yang login ke dalam request
                req.name = decoded.name;
                req.UserID = decoded.id;
                next();
            }

        })
    }
}


app.get("/", verifyUser, async (req, res) => {
    // mengambil data user yang di kirim dari function verifyUser
    // console.log("user id",req.UserID)

    // mengambil data user yang lebih lengkap
    let user = "SELECT * FROM user u WHERE UserId = ?"
    const dataUser = await selectData(user, [req.UserID])

    // mengambil postingan / foto yang di buat oleh user
    let post = "SELECT f.* FROM foto f WHERE f.UserId = ?"
    const dataPost = await selectData(post, [req.UserID])

    let likePost = "SELECT f.*, u.Username FROM foto f JOIN likefoto lf ON f.FotoID = lf.FotoID JOIN user u ON lf.UserID = u.UserID WHERE lf.UserID = ?"
    const dataLikePost = await selectData(likePost, [req.UserID])




    // kirim data sebagai response
    return res.json({
        status: 'success',
        user: dataUser[0],
        post: dataPost,
        // album: dataAlbum,
        likePost: dataLikePost,
    })
})


app.get("/profile/:id", async (req, res) => {
    const userID = req.params.id;

    let user = "SELECT * FROM user WHERE UserID = ?"
    const dataUser = await selectData(user, [userID])

    // mengambil postingan / foto yang di buat oleh user
    let post = "SELECT f.* FROM foto f WHERE f.UserID = ?";
    const dataPost = await selectData(post, [userID]);


    let likePost = "SELECT f.*, u.Username FROM foto f JOIN likefoto lf ON f.FotoID = lf.FotoID JOIN user u ON lf.UserID = u.UserID WHERE lf.UserID = ?"
    const dataLikePost = await selectData(likePost, [userID])

    return res.json({
        status: 'success',
        // user: dataUser,
        user: dataUser[0],
        post: dataPost,
        likePost: dataLikePost,
    })
})



app.post('/AccountVisit', verifyUser,async (req, res) => {
    // const visitorId = req.UserID; // Access user ID from request object
    const profileId = req.body.profile;

    // Check if any required field is null
    if (!profileId) {
        return res.status(400).json({
            status: 'error',
            message: 'Profile ID is a required field'
        });
    }

    // Check if the visitor has already visited the profile
    const query = "SELECT COUNT(*) AS count FROM profilevisit WHERE VisitorID = ? AND ProfileID = ?";
    db.query(query, [visitorId, profileId], (err, result) => {
        if (err) {
            console.error("Error checking if visit exists:", err);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to check if visit exists'
            });
        }

        const visitExists = result[0].count > 0;

        if (visitExists) {
            // If visit already exists, send a response indicating it
            return res.json({
                status: 'error',
                message: 'Visit already recorded'
            });
        } else {
            // If visit doesn't exist and required fields are not null, insert new record
            const TanggalVisit = new Date();
            const formattedDate = TanggalVisit.toISOString().slice(0, 19).replace('T', ' ');

            const q = "INSERT INTO profilevisit (VisitorID, ProfileID, TanggalVisit) VALUES (?,?,?)";
            db.query(q, [req.UserID, profileId, formattedDate], (err, result) => {
                if (err) {
                    console.error("Error inserting visit into database:", err);
                    return res.status(500).json({
                        status: 'error',
                        message: 'Failed to record visit'
                    });
                }

                return res.json({
                    status: 'success'
                });
            });
        }
    });
});



app.put("/user/update", (req, res) => {
    const {
        UserID,
        NamaLengkap,
        Alamat,
        Bio,
        TanggalLahir
    } = req.body

    // console.log( UserID, NamaLengkap, Alamat, Bio, TanggalLahir)

    const updateUserQuery = "UPDATE user SET NamaLengkap=?, Alamat=?, Bio=?, TanggalLahir=? WHERE UserID=?";

    db.query(updateUserQuery, [NamaLengkap, Alamat, Bio, TanggalLahir, UserID], (err, result) => {
        if (err) {
            console.error(err);
            return res.json({
                status: 'error',
                message: "Failed to update user"
            });
        }
        return res.json({
            status: 'success',
            message: "User updated successfully"
        });
    });
});

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
                const id = user.UserID; // menambahkan id
                const token = jwt.sign({
                    name,
                    id // menambahkan id
                }, "our-jsonwebtoken-secret-key", {
                    expiresIn: '1d'
                });

                // Insert login history record
                const loginTime = new Date();
                const insertQ = "INSERT INTO loginhistory (UserID, Login_Time) VALUES (?, ?)";
                db.query(insertQ, [id, loginTime], (err, result) => {
                    if (err) {
                        console.error("Error inserting login history:", err);
                        return res.json({
                            message: "Error inserting login history"
                        });
                    }
                    console.log("Login history inserted successfully");

                    // Return token and success status to client
                    return res.json({
                        token,
                        status: "success",
                    });
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


// Log History
app.get("/login-history/:id", async (req, res) => {
    const userID = req.params.id;

    let loginHistory = "SELECT * FROM loginhistory WHERE UserID = ? ORDER BY Login_Time DESC LIMIT 1"
    const dataLog = await selectData(loginHistory, userID)


    // console.log(dataLog)
    return res.json({
        loginHistory: dataLog,

    });

});
// CRUD POSTS


app.post('/upload', upload.single('LokasiFile'), (req, res) => {
    const LokasiFile = req.file.filename;
    const JudulFoto = req.body.JudulFoto;
    const DeskripsiFoto = req.body.DeskripsiFoto;
    const userID = req.body.userID;
    const albumSelected = req.body.AlbumID;

    const TanggalUp = new Date();
    const formattedDate = TanggalUp.toISOString().slice(0, 19).replace('T', ' ');

    const qFoto = "INSERT INTO foto (`JudulFoto`, `LokasiFile`, `DeskripsiFoto`, `TanggalUnggah`, `UserID`) VALUES (?, ?, ?, ?, ?)";
    db.query(qFoto, [JudulFoto, LokasiFile, DeskripsiFoto, formattedDate, userID], (err, result) => {
        if (err) {
            console.error(err);
            return res.json({
                message: "error bang"
            });
        }

        const fotoID = result.insertId; // Assuming `insertId` contains the newly inserted photo ID

        const qAlbumFoto = "INSERT INTO albumfoto (`AlbumID`, `FotoID`) VALUES (?, ?)";

        // Check if albumSelected is not empty
        if (albumSelected) {
            db.query(qAlbumFoto, [albumSelected, fotoID], (err, result) => {
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
        } else {
            // Continue to response if albumSelected is empty
            return res.json({
                status: 'success'
            });
        }
        
    });
});



app.get('/posts', (req, res) => {
    const q = "SELECT f.*, u.Username FROM foto f LEFT JOIN user u ON u.UserID = f.UserID"
    db.query(q, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})

// app.get('/posts/user/:id', (req, res) => {
//     const userID = req.params.id;
//     const q = "SELECT f.* FROM foto f WHERE f.UserID = ?";
//     db.query(q, [userID], (err, data) => {
//         if (err) {
//             console.error(err);
//             return res.status(500).json(err);
//         }
//         return res.json(data);
//     });
//     console.log("ini user id : "+userID)
// });

app.get('/like/user/:id', (req, res) => {
    const userID = req.params.id;
    const q = "SELECT f.* FROM foto f JOIN likefoto lf on f.FotoID = lf.FotoID WHERE lf.UserID = ?";
    db.query(q, [userID], (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).json(err);
        }
        return res.json(data);
    });
    // console.log("ini user id : " + userID)
});

app.get('/posts/:id', (req, res) => {
    const FotoID = req.params.id;
    const q = `
    SELECT f.*, u.UserID as UserID, u.Username, u.NamaLengkap 
    FROM foto f 
    LEFT JOIN user u ON u.UserID = f.UserID 
    WHERE f.FotoID = ?
`;

    db.query(q, [FotoID], (err, data) => {
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.delete("/posts/delete/:id", (req, res) => {
    const id = req.params.id;
    const qDeleteLike = "DELETE FROM likefoto WHERE FotoID = ?";
    const qDeleteComment = "DELETE FROM komentarfoto WHERE FotoID = ?";
    const qDeleteFoto = "DELETE FROM foto WHERE FotoID = ?";
    const qDeleteFromAlbum = "DELETE FROM albumfoto WHERE FotoID = ?";

    db.query(qDeleteLike, [id], (err, likeData) => {
        if (err) {
            console.error(err);
            return res.status(500).json(err);
        }

        db.query(qDeleteComment, [id], (err, commentData) => {
            if (err) {
                console.error(err);
                return res.status(500).json(err);
            }

            db.query(qDeleteFromAlbum, [id], (err, albumData) => {
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
    });
});


// End CRUD Posts


// Start CRUD Album
app.get('/album/user/:id', async (req, res) => {
    const userId = req.params.id
    // const albumId = req.body.albumId

    let album = "SELECT a.* FROM album a WHERE a.User_ID = ?"
    let dataAlbum = await selectData(album, userId)

    // album nya di looping
    let albumPost = dataAlbum.map(async (albm) => {
        // mengambil foto di table albumFoto berdasarkan album id 
        let post = "SELECT f.* FROM albumfoto af LEFT JOIN foto f ON af.FotoID = f.FotoID WHERE af.AlbumID = ?"
        const foto = await selectData(post, albm.AlbumID)

        // memasukan foto ke dalam object album 
        albm.foto = foto

        // mengembalikan data album yang sudah di modifikasi
        return albm
    })

    // menerima data album yang sudah di modifikasi
    const albumData = await Promise.all(albumPost)

    // console.log(albumData)
    return res.json({
        album: albumData,
    })

});
app.post('/add-album', (req, res) => {
    const namaAlb = req.body.namaAlbum;
    const albDesc = req.body.descAlbum;
    const UserID = req.body.UserID;
    const selectedPosts = req.body.selectedPosts; // Array of selected photo IDs

    const tglDibuat = new Date(); // Creating a Date object from the current timestamp

    const q1 = 'INSERT INTO album (NamaAlbum, Deskripsi, TanggalDibuat, User_ID) VALUES (?, ?, ?, ?)';

    db.query(q1, [namaAlb, albDesc, tglDibuat, UserID], (err, result) => {
        if (err) {
            console.error(err);
            return res.json({
                message: "error bang"
            });
        }

        const albumID = result.insertId; // Use `insertId` to get the newly inserted album ID
        const insertPromises = selectedPosts.map((photoID) => {
            db.query('INSERT INTO albumfoto (AlbumID, FotoID) VALUES (?, ?)', [albumID, photoID], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.json({
                        message: "error bang"
                    });
                }
            });
        });

        Promise.all(insertPromises).then(() => {
            return res.json({
                status: 'success'
            });
        }).catch((error) => {
            console.error(error);
            return res.json({
                message: "error bang"
            });
        });
    });
});
app.delete("/album/delete/:id", (req, res) => {
    const albumID = req.params.id;

    const qDeleteAlbum = "DELETE FROM album WHERE AlbumID = ?";
    const qDeleteAlbumFoto = "DELETE FROM albumfoto WHERE AlbumID = ?";

    // Use Promise.all to wait for both delete operations to finish
    Promise.all([
            new Promise((resolve, reject) => {
                db.query(qDeleteAlbumFoto, [albumID], (err, albumFotoData) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            }),
            new Promise((resolve, reject) => {
                db.query(qDeleteAlbum, [albumID], (err, albumData) => {
                    if (err) {
                        console.error(err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            })
        ])
        .then(() => {
            return res.json("Album deleted successfully");
        })
        .catch((err) => {
            return res.status(500).json(err);
        });
});


// End CRUD Album

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

});


// Start Post Comment

app.get('/comment/:FotoID', async (req, res) => {
    const FotoID = req.params.FotoID;

    let qcomment = "SELECT * FROM komentarfoto WHERE FotoID = ?"
    const dataComment = await selectData(qcomment, FotoID)

    let user = "SELECT u.* FROM user u JOIN komentarfoto k ON u.UserID = k.UserID"
    const dataUser = await selectData(user)

    return res.json({
        status: 'success',
        comment: dataComment,
        user: dataUser
    })

});

app.post('/comment/:FotoID', (req, res) => {
    const FotoID = req.params.FotoID;
    const UserID = req.body.userId
    const IsiKomentar = req.body.isiKomentar

    const TanggalComment = new Date()

    const q = "INSERT INTO komentarfoto (`IsiKomentar`, `TanggalKomentar`, `UserID`, `FotoID`) VALUES (?,?,?,?)"
    db.query(q, [IsiKomentar, TanggalComment, UserID, FotoID],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    message: "Error commenting photo"
                });
            }
            return res.json({
                status: 'success',
                message: 'suksesss'
            });
        })
})

app.delete("/comment/delete/:id", (req, res) => {
    const id = req.params.id;

    const qDeleteComment = "DELETE FROM komentarfoto WHERE komentarID = ?";
    db.query(qDeleteComment, [id], (err, res) => {
        if (err) {
            console.error(err);
            return res.status(500).json(err);
        }

    });

})
// End Post Comment



// Start CRUD Likes

// GET request to get total like count for a photo
app.get('/save/:FotoID', (req, res) => {
    const FotoID = req.params.FotoID;
    const userId = req.query.userId;

    console.log("User ID: ", userId);
    getSaveCount(FotoID, userId, res);
});

app.get('/save/detail/:userId', async(req, res) => {
    const userId = req.params.userId;

    let getSaveDetail = "SELECT sf.*, f.* FROM simpanfoto sf JOIN foto f ON sf.FotoID = f.FotoID WHERE sf.UserID = ?"
    const dataSaveDetail = await selectData(getSaveDetail, userId)

    let getImageDetails = "SELECT u.*, f.LokasiFile FROM simpanfoto sf JOIN foto f ON sf.FotoID = f.FotoID JOIN user u ON f.UserID = u.UserID WHERE sf.UserID = ?"
    const dataImageDetails = await selectData(getImageDetails, userId)


    return res.json({
        status: 'success',
        getSaveDetail: dataSaveDetail,
        getImageDetails: dataImageDetails
    })

});



function getSaveCount(FotoID, userId, res) {
    const qCount = "SELECT COUNT(*) AS saveCount FROM simpanfoto WHERE FotoID = ?";
    const qSaved = "SELECT * FROM simpanfoto WHERE FotoID = ? AND UserID = ?";

    db.query(qCount, [FotoID], (err, countResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Error fetching like count"
            });
        }

        db.query(qSaved, [FotoID, userId], (err, saveResult) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    message: "Error fetching like status"
                });
            }

            const saveCount = countResult[0].saveCount;
            const saved = saveResult.length > 0;

            return res.json({
                saveCount: saveCount,
                saved: saved
            });
        });
    });
}



// POST request to like a photo
app.post('/save/:FotoID', (req, res) => {
    const FotoID = req.params.FotoID;
    const UserID = req.body.userId; // Retrieve UserID from request body

    const TanggalSave = new Date(); // Creating a Date object from the current timestamp

    // Insert into likefoto table
    const q = "INSERT INTO simpanfoto (FotoID, UserID, TanggalSimpan) VALUES (?, ?, ?)";
    db.query(q, [FotoID, UserID, TanggalSave], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Error liking photo"
            });
        }
        // Return updated like count for the photo by the user
        getSaveCount(FotoID, UserID, res);
    });
});

app.post('/unsave/:FotoID', (req, res) => {
    const FotoID = req.params.FotoID;
    const UserID = req.body.userId;

    const q = "DELETE FROM simpanfoto WHERE FotoID = ? AND UserID = ?"
    db.query(q, [FotoID, UserID], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                message: "Error unliking photo"
            });
        }
        // Return updated like count
        getSaveCount(FotoID, UserID, res);
    });

});



// Insight get data start
app.get('/insight/:UserID', async (req, res) => {
    const userId = req.params.UserID;

    let totalLike = "SELECT SUM(likeCount) AS totalLikeCount FROM ( SELECT COUNT(*) AS likeCount FROM likefoto WHERE FotoID IN ( SELECT FotoID FROM foto WHERE UserID = ? ) GROUP BY FotoID ) AS counts"
    const dataTotalLike = await selectData(totalLike, userId)


    let totalSaves = "SELECT COUNT(*) AS totalSaveCount FROM simpanfoto WHERE UserID = ?"
    const dataTotalSave = await selectData(totalSaves, userId)

    let totalUpload = "SELECT COUNT(*) AS totalUploadCount FROM foto WHERE UserID = ?"
    const dataTotalUpload = await selectData(totalUpload, userId)


    let profileVisit = " SELECT MONTH(TanggalVisit) AS month, COUNT(*) AS visitCount FROM profilevisit WHERE ProfileID = ? GROUP BY MONTH(TanggalVisit)"
    const dataProfileVisit = await selectData(profileVisit, userId)

    console.log(dataTotalLike)

    return res.json({
        status: 'success',
        totalLike: dataTotalLike,
        totalSaves: dataTotalSave,
        totalUpload: dataTotalUpload,
        profileVisit :dataProfileVisit
    })

});

// Insight get data end



app.listen(8800, () => {
    console.log("You are connected to the server 8800!")
})