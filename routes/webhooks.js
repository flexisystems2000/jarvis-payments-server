const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const db = require("../services/firestore");

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
            const customerPhone = paymentData.customer.phone;
            const customerName = `${paymentData.customer.first_name || ""} ${paymentData.customer.last_name || ""}`.trim();
            const reference = paymentData.reference;
            const amountPaid = paymentData.amount / 100; // Convert from kobo to Naira

            console.log(`💰 Payment Confirmed: ₦${amountPaid} from ${customerPhone || customerName} | Ref: ${reference}`);

            // 🎯 FIXED TRACKING: Find the exact pending document using Paystack's reference token
            if (reference) {
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
                    console.log(`✅ Firestore updated successfully for transaction reference: ${reference}`);
                } else {
                    // Fallback: If no match exists, log it cleanly anyway using the normalized phone info
                    const cleanPhone = customerPhone ? customerPhone.replace(/[^0-9]/g, "") : "N/A";
                    await db.collection("payment_requests").add({
                        name: customerName || "Paystack User",
                        phone: cleanPhone,
                        status: "completed",
                        paystackReference: reference,
                        amountPaid: amountPaid,
                        createdAt: new Date(),
                        paidAt: new Date()
                    });
                    console.log(`📝 Reference mismatch fallback. Logged direct receipt.`);
                }
            }
        }
    } catch (err) {
        console.log("❌ Paystack Webhook Error:", err.message);
        // Fallback safety ensure server doesn't crash
        if (!res.headersSent) res.sendStatus(500);
    }
});

module.exports = router;
