require("dotenv").config();

const express = require("express");
const cors = require("cors");

const paymentRoutes =
    require("./routes/payments");

const webhookRoutes =
    require("./routes/webhooks");

const app = express();

// =====================================================
// SECURITY + CORS
// =====================================================

app.use(cors());

// =====================================================
// VERY IMPORTANT:
// PAYSTACK WEBHOOK RAW BODY HANDLER
// =====================================================

// Paystack signs RAW request body.
// This MUST come BEFORE express.json()

app.use(
    "/webhooks/paystack",
    express.raw({
        type: "application/json"
    })
);

// =====================================================
// NORMAL JSON PARSER
// =====================================================

app.use(express.json({
    limit: "10mb"
}));

app.use(express.urlencoded({
    extended: true
}));

// =====================================================
// REQUEST LOGGER (OPTIONAL BUT USEFUL)
// =====================================================

app.use((req, res, next) => {

    console.log(
        `📡 ${req.method} ${req.originalUrl}`
    );

    next();

});

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
// HOME ROUTE
// =====================================================

app.get("/", (req, res) => {

    res.status(200).json({

        success: true,

        server: "Jarvis Payment Server",

        status: "ONLINE",

        timestamp: Date.now()

    });

});

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {

    res.status(404).json({

        success: false,

        message:
            "❌ Route Not Found"

    });

});

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use((err, req, res, next) => {

    console.log(
        "❌ GLOBAL SERVER ERROR:",
        err.message
    );

    res.status(500).json({

        success: false,

        error:
            "Internal Server Error"

    });

});

// =====================================================
// START SERVER
// =====================================================

const PORT =
    process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(
        `🚀 Payment Server Running On Port ${PORT}`
    );

});
