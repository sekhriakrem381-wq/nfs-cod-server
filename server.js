const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

app.post('/create-order', async (req, res) => {
  console.log("--- NEW REQUEST RECEIVED ---");
  try {
    const { product_variant_id, customer_name, customer_phone, shipping_address } = req.body;

    // --== خطوة تشخيص 1: طباعة البيانات المستلمة ==--
    console.log("Received variant ID:", product_variant_id);
    console.log("Received customer name:", customer_name);

    if (!product_variant_id || !customer_name || !customer_phone || !shipping_address) {
      console.error("Error: Missing data from form.");
      return res.status(400).json({ success: false, message: 'Missing data.' });
    }
    
    const draftOrderPayload = {
      draft_order: {
        line_items: [{ 
          variant_id: parseInt(product_variant_id), // التأكد من أنه رقم
          quantity: 1 
        }],
        note: `عنوان الزبون: ${shipping_address}`,
        customer: {
          first_name: customer_name,
          last_name: "(COD Form)",
          phone: customer_phone
        }
      }
    };
    
    // --== خطوة تشخيص 2: طباعة البيانات قبل إرسالها ==--
    console.log("Payload being sent to Shopify:", JSON.stringify(draftOrderPayload, null, 2));

    const draftResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2024-04/draft_orders.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
      body: JSON.stringify(draftOrderPayload)
    });

    const responseStatus = draftResponse.status;
    const responseData = await draftResponse.json();

    // --== خطوة تشخيص 3: طباعة استجابة شوبيفاي الكاملة ==--
    console.log("--- SHOPIFY API RESPONSE ---");
    console.log("STATUS:", responseStatus);
    console.log("BODY:", JSON.stringify(responseData, null, 2));
    console.log("----------------------------");

    if (!draftResponse.ok) {
      throw new Error(`Shopify returned an error status: ${responseStatus}`);
    }

    if (!responseData.draft_order || !responseData.draft_order.id) {
        throw new Error("Shopify response did not contain draft_order.id");
    }

    const draftOrderId = responseData.draft_order.id;
    console.log(`Draft Order ${draftOrderId} created. Completing...`);

    const completeResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2024-04/draft_orders/${draftOrderId}/complete.json?payment_pending=true`, {
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN }
    });

    const completeData = await completeResponse.json();
    if (!completeResponse.ok) {
      console.error('DRAFT COMPLETION ERROR:', JSON.stringify(completeData, null, 2));
      throw new Error('Failed to complete draft order.');
    }
    
    const finalOrder = completeData.draft_order;
    console.log(`Successfully created order ID: ${finalOrder.order_id}.`);
    res.status(200).json({ success: true, order_id: finalOrder.order_id });

  } catch (error) {
    console.error('SERVER ERROR:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
