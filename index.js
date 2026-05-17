require("dotenv").config();

const express = require("express");
const cors = require("cors");

const paymentRoutes =
    require("./routes/payments");

const webhookRoutes =
    require("./routes/webhooks");

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(express.json({
    limit: "10mb"
}));

app.use(express.urlencoded({
    extended: true
}));

// =====================================================
// ROUTES
// =====================================================

app.use(
    "/payments",
    paymentRoutes
);

app.use(
    "/webhooks",
    webhookRoutes
);

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {

    res.json({

        success: true,

        message:
            "💰 Jarvis Payment Server Online"

    });

});

// =====================================================
// START SERVER
// =====================================================

const PORT =
    process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(
        `🚀 Payment Server Running On ${PORT}`
    );

});
