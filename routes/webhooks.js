const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const axios = require("axios");
const db = require("../services/firestore");

// 🔥 Point this to your live Jarvis AI Bot URL on Render or wherever it's hosted
const WHATSAPP_BOT_URL = process.env.WHATSAPP_BOT_URL || "https://jarvisaiserver.onrender.com";

// =====================================================
// PAYSTACK WEBHOOK (Autopilot Confirmation)
// =====================================================
router.post("/paystack", async (req, res) => {
    try {
        // 🔒 Validate that this request actually came from Paystack
        const hash = crypto
            .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest("hex");

        if (hash !== req.headers["x-paystack-signature"]) {
            console.log("⚠️ Unauthorized webhook attempt blocked.");
            return res.sendStatus(401);
        }

        // Fast 200 OK acknowledgment to Paystack
        res.sendStatus(200);

        const event = req.body;

        if (event.event === "charge.success") {
            const paymentData = event.data;
            const reference = paymentData.reference;
            const amountPaid = paymentData.amount / 100;

            // Gather metadata fields you initialized earlier
            const metadataFields = paymentData.metadata?.custom_fields || [];
            const phoneField = metadataFields.find(f => f.variable_name === "phone_number")?.value;
            const planField = metadataFields.find(f => f.variable_name === "plan_type")?.value || "Flexi Tutorials Access";
            
            // Fallback strategy if custom fields aren't parsed
            const rawPhone = phoneField || paymentData.customer.phone || "";
            const cleanPhone = rawPhone.replace(/[^0-9]/g, "");

            if (reference && cleanPhone) {
                // 1. Update status to completed inside Firestore
                const snapshot = await db.collection("payment_requests")
                    .where("paystackReference", "==", reference)
                    .where("status", "==", "pending")
                    .limit(1)
                    .get();

                if (!snapshot.empty) {
                    const docId = snapshot.docs[0].id;
                    await db.collection("payment_requests").doc(docId).update({
                        status: "completed",
                        amountPaid: amountPaid,
                        paidAt: new Date()
                    });
                    console.log(`✅ Firestore updated to completed for: ${reference}`);
                } else {
                    // Fallback log entry if initialization record wasn't present
                    await db.collection("payment_requests").add({
                        phone: cleanPhone,
                        item: planField,
                        status: "completed",
                        paystackReference: reference,
                        amountPaid: amountPaid,
                        createdAt: new Date(),
                        paidAt: new Date()
                    });
                }

                // 2. 📡 THE REVOLUTION TRIGGER: Ping the WhatsApp Bot instantly
                try {
                    console.log(`📡 Pinging Jarvis Bot for student phone: ${cleanPhone}`);
                    await axios.post(`${WHATSAPP_BOT_URL}/payment-success`, {
                        phone: cleanPhone,
                        plan: planField
                    }, {
                        headers: { "Content-Type": "application/json" }
                    });
                } catch (botErr) {
                    console.log("❌ Webhook couldn't hit your WhatsApp bot service route:", botErr.message);
                }
            }
        }
    } catch (err) {
        console.log("❌ Paystack Webhook Engine Error:", err.message);
    }
});

module.exports = router;
