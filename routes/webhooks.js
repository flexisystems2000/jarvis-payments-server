const express =
    require("express");

const router =
    express.Router();

// =====================================================
// MONNIFY WEBHOOK
// =====================================================

router.post(
    "/monnify",

    async (req, res) => {

        try {

            console.log(
                "💰 Webhook Received"
            );

            console.log(req.body);

            return res.sendStatus(200);

        } catch (err) {

            console.log(err);

            return res.sendStatus(500);
        }
    }
);

module.exports = router;
