const express = require("express");
const router = express.Router();
const axios = require("axios");
const db = require("../services/firestore");

// =====================================================
// INITIALIZE PAYSTACK FOR TUTORIALS (WEEKLY / MONTHLY)
// =====================================================
router.post("/initialize", async (req, res) => {
    try {
        const { name, phone, email, planType } = req.body;
        
        // Determine amount based on chosen plan type
        let feeAmount = 6000; // Default Monthly
        let planLabel = "Flexi Tutorials - Monthly Access";

        if (planType === "week" || planType === "weekly") {
            feeAmount = 1500;
            planLabel = "Flexi Tutorials - Weekly Access";
        }

        const amountInKobo = feeAmount * 100; 
        const customerEmail = email || `${phone}@flexitutors.com`;

        // 1. Call Paystack API
        const paystackResponse = await axios.post(
            "https://api.paystack.co/transaction/initialize",
            {
                email: customerEmail,
                amount: amountInKobo,
                metadata: {
                    custom_fields: [
                        { display_name: "Student Name", variable_name: "student_name", value: name || "WhatsApp Student" },
                        { display_name: "Phone Number", variable_name: "phone_number", value: phone },
                        { display_name: "Payment Plan", variable_name: "plan_type", value: planLabel }
                    ]
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        if (paystackResponse.data && paystackResponse.data.status) {
            const { authorization_url, reference } = paystackResponse.data.data;

            // 2. Log exactly what they are paying for in Firestore
            await db.collection("payment_requests").add({
                name: name || "WhatsApp Student",
                phone: phone.replace(/[^0-9]/g, ""),
                item: planLabel,
                status: "pending",
                paystackReference: reference,
                amountPaid: feeAmount,
                createdAt: new Date()
            });

            return res.json({
                success: true,
                paymentUrl: authorization_url,
                reference: reference
            });
        } else {
            return res.status(500).json({ success: false, error: "Paystack initialization failed." });
        }

    } catch (err) {
        console.error("Initialization Error:", err.response?.data || err.message);
        return res.status(500).json({
            success: false,
            error: err.response?.data?.message || err.message
        });
    }
});

module.exports = router;
