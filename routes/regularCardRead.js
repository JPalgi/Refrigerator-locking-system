let express     = require("express"),
    rc522       = require("rc522"),
    middleware  = require("../middleware/regularAuth"),
    sqlFun      = require("../middleware/sqlFun"),
    errorCodes  = require("../middleware/errorCodes"),
    buzzer      = require("../middleware/gpio"),
    email       = require("../middleware/sendMail"),
    router      = express.Router();

router.get("/", (req, res) => {
    res.render("home");
});

router.get("/kaart", (req, res, next) => {
    rc522.init();
    rc522.read(async (serial) => {       
	buzzer.ring();
        rc522.child();
        let kasutaja = await sqlFun.kasutajaKaardiLugemisel(next, serial);

        if (kasutaja.length > 0) {
            if (kasutaja[0].admin_on_kinnitanud === 1 && (kasutaja[0].kasutaja_seisu_id === 1 || kasutaja[0].kasutaja_seisu_id === 2)) {
                middleware.addUserCard(serial);
		if (kasutaja[0].kasutaja_staatuse_id === 1) res.redirect("/tooted/" + serial + "/paneKirja");
		else res.redirect("/tooted/" + serial);
            } else {
                if (kasutaja[0].admin_on_kinnitanud === 0) {
                    let err = new Error(errorCodes.ADMINI_KINNITUS_PUUDUB.message);
                    err.statusCode = errorCodes.ADMINI_KINNITUS_PUUDUB.code;
                    next(err);
		} else {
                    let err = new Error(errorCodes.VÄLJALANGENU.message);
                    err.statusCode = errorCodes.VÄLJALANGENU.code;
                    next(err);
                }
            }
        } else {
            res.redirect("/registreeri/" + serial);
        }
    });
});

router.get("/registreeri/:id", (req, res) => {
    let id = req.params.id;
    res.render("registreeri", {id: id});
});

router.post("/kinnitaKasutaja/:id", async (req, res, next) => {
    await sqlFun.kinnitaKasutaja(req.params.id, next);

    req.flash("SUCCESS2", "Kasutaja on kinnitatud!", "/");
});

router.post("/registreeri/:id", async (req, res, next) => {
    let uusKasutaja = {
        id: req.params.id,
        eesnimi: req.body.eesnimi,
        perenimi: req.body.perenimi,
        staatus: parseFloat(req.body.staatuse_id),
        coetus: req.body.coetus
    };

    let staatuseNimetus = await sqlFun.registreeriKasutaja(uusKasutaja, next);

    // Anna bibendile teada uue kasutaja registreerimisest
    let nimi = `Nimi - ${uusKasutaja.eesnimi} ${uusKasutaja.perenimi}`;
    let staatus = `Staatus - ${staatuseNimetus}`;
    let coetusTxt = `Coetus - ${uusKasutaja.coetus}`;
    let link = `http://192.168.1.243:3000/kinnitaKasutaja/${uusKasutaja.id}`;
    let html = `<p><h1>Uus kasutaja vajab kinnitamist!</h1><ul><li>${nimi}</li><li>${staatus}</li><li>${coetusTxt}</li>
    </ul><form action="${link}" method="POST"><button type="submit">Kinnita kasutaja, vajuta siia</button></form></p>`;
    email.sendMail("Uus Kasutaja registreeris ennast süsteemi", req, html, next);
});

module.exports = router;
