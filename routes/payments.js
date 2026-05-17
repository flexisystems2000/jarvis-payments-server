const express =
    require("express");

const router =
    express.Router();

const db =
    require("../services/firestore");

// =====================================================
// CREATE PAYMENT REQUEST
// =====================================================

router.post(
    "/create-payment",

    async (req, res) => {

        try {

            const {
                name,
                phone
            } = req.body;

            if (!name || !phone) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Name and phone required"

                });
            }

            await db
                .collection(
                    "payment_requests"
                )
                .add({

                    name,
                    phone,

                    status:
                        "pending",

                    createdAt:
                        new Date()

                });

            return res.json({

                success: true,

                message:
                    "Payment request created"

            });

        } catch (err) {

            console.log(err);

            return res.status(500).json({

                success: false,

                error:
                    err.message

            });
        }
    }
);

module.exports = router;
