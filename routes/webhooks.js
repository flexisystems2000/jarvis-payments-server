const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const axios = require("axios");
const db = require("../services/firestore");

// 🔥 POINT THIS TO YOUR WHATSAPP BOT'S PUBLIC URL (e.g., another Render instance or Ngrok)
const WHATSAPP_BOT_URL = process.env.WHATSAPP_BOT_URL || "https://your-whatsapp-bot-url.onrender.com";

// =====================================================
// PAYSTACK WEBHOOK (Autopilot Confirmation)
// =====================================================
router.post("/paystack", async (req, res) => {
    try {
        // 🔒 SECURITY GUARD: Validate that this request actually came from Paystack
        const hash = crypto
            .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest("hex");

        if (hash !== req.headers["x-paystack-signature"]) {
            console.log("⚠️ Unauthorized webhook attempt blocked.");
            return res.sendStatus(401);
        }

        // Send Paystack an immediate 200 OK so they don't timeout or retry
        res.sendStatus(200);

        const event = req.body;

        // Listen explicitly for successful transactions
        if (event.event === "charge.success") {
            const paymentData = event.data;
            
            // Extract metadata fields we saved during initialization
            const metadataFields = paymentData.metadata?.custom_fields || [];
            const phoneField = metadataFields.find(f => f.variable_name === "phone_number")?.value;
            const planField = metadataFields.find(f => f.variable_name === "plan_type")?.value || "Flexi Tutorials Access";
            
            const reference = paymentData.reference;
            const amountPaid = paymentData.amount / 100; // Convert from kobo to Naira

            // Fallback to customer phone if metadata is completely empty
            const rawPhone = phoneField || paymentData.customer.phone || "";
            const cleanPhone = rawPhone.replace(/[^0-9]/g, "");

            console.log(`💰 Payment Confirmed: ₦${amountPaid} from ${cleanPhone} | Ref: ${reference}`);

            if (reference && cleanPhone) {
                // 1. Update the document status to "completed" inside Firestore
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
                    console.log(`✅ Firestore updated to completed for reference: ${reference}`);
                } else {
                    // Fallback: Create completed record if it doesn't exist yet
                    await db.collection("payment_requests").add({
                        phone: cleanPhone,
                        item: planField,
                        status: "completed",
                        paystackReference: reference,
                        amountPaid: amountPaid,
                        createdAt: new Date(),
                        paidAt: new Date()
                    });
                    console.log(`📝 Created direct completed receipt in Firestore.`);
                }

                // 2. 🚀 THE WEBHOOK EVENT TRIGGER: Alert your WhatsApp Bot immediately!
                try {
                    console.log(`📡 Pinging WhatsApp Bot server for phone: ${cleanPhone}`);
                    await axios.post(`${WHATSAPP_BOT_URL}/payment-success`, {
                        phone: cleanPhone,
                        plan: planField
                    }, {
                        headers: { "Content-Type": "application/json" }
                    });
                    console.log(`🎉 WhatsApp Bot successfully notified.`);
                } catch (botErr) {
                    console.log("❌ Failed to contact WhatsApp bot endpoint:", botErr.message);
                }
            }
        }
    } catch (err) {
        console.log("❌ Paystack Webhook Error:", err.message);
        if (!res.headersSent) res.sendStatus(500);
    }
});

module.exports = router;

